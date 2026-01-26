/**
 * BOT MANAGER - POUR TESTS UNIQUEMENT
 *
 * Gère les bots de poker pour permettre aux joueurs de tester l'application.
 * À RETIRER EN PRODUCTION
 */

import { Server } from 'socket.io';
import { PokerBot, generateBotId, generateBotName, getBotDifficultyForTable } from './Bot';
import { PokerTable } from './Table';
import { PlayerAction } from '../shared/types/game';
import { turnTimerManager } from './TurnTimer';
import { awayManager, CONSECUTIVE_TIMEOUTS_THRESHOLD } from './AwayManager';
import { prisma } from '../config/database';

interface BotInstance {
  bot: PokerBot;
  tableId: string;
  seatNumber: number;
}

class BotManager {
  private bots: Map<string, BotInstance> = new Map();
  private botActionTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Ajoute un bot à une table
   */
  addBotToTable(
    table: PokerTable,
    tableId: string,
    buyIn: number,
    io?: Server
  ): PokerBot | null {
    const botId = generateBotId();
    const botName = generateBotName();
    const difficulty = getBotDifficultyForTable(tableId);

    const bot = new PokerBot({
      odId: botId,
      username: botName,
      difficulty,
      chipStack: buyIn,
    });

    // Trouver un siège libre
    const state = table.getState();
    const occupiedSeats = state.players.map(p => p.seatNumber);
    let freeSeat = -1;

    for (let i = 0; i < state.maxPlayers; i++) {
      if (!occupiedSeats.includes(i)) {
        freeSeat = i;
        break;
      }
    }

    if (freeSeat === -1) {
      console.log(`No free seat for bot on table ${tableId}`);
      return null;
    }

    // Ajouter le bot à la table
    const success = table.addPlayer(botId, botName, freeSeat, buyIn);
    if (!success) {
      console.log(`Failed to add bot to table ${tableId}`);
      return null;
    }

    this.bots.set(botId, {
      bot,
      tableId,
      seatNumber: freeSeat,
    });

    console.log(`Bot ${botName} (${difficulty}) joined table ${tableId} at seat ${freeSeat}`);

    // Notifier les autres joueurs si io est fourni
    if (io) {
      io.to(`table:${tableId}`).emit('table:player-joined', {
        player: {
          odId: botId,
          username: botName,
          seatNumber: freeSeat,
          chipStack: buyIn,
          isBot: true,
        },
      });
    }

    return bot;
  }

  /**
   * Retire un bot d'une table
   */
  removeBotFromTable(botId: string, table: PokerTable): void {
    const botInstance = this.bots.get(botId);
    if (!botInstance) return;

    // Annuler tout timer en cours
    const timer = this.botActionTimers.get(botId);
    if (timer) {
      clearTimeout(timer);
      this.botActionTimers.delete(botId);
    }

    table.removePlayer(botInstance.seatNumber);
    this.bots.delete(botId);

    console.log(`Bot ${botId} removed from table ${botInstance.tableId}`);
  }

  /**
   * Fait jouer le bot si c'est son tour
   */
  processBotTurn(
    table: PokerTable,
    tableId: string,
    io: Server,
    onActionComplete?: () => void
  ): void {
    const state = table.getState();
    const currentPlayerId = state.currentPlayerId;

    // Pas de joueur actuel ou phase d'attente/showdown
    if (!currentPlayerId || state.phase === 'waiting' || state.phase === 'showdown') return;

    const botInstance = this.bots.get(currentPlayerId);
    // Ce n'est pas un bot, c'est un vrai joueur
    if (!botInstance) return;

    // Éviter les appels multiples pour le même bot
    if (this.botActionTimers.has(currentPlayerId)) {
      return;
    }

    const bot = botInstance.bot;

    // Obtenir l'état du jeu du point de vue du bot
    const botState = table.getState(currentPlayerId);
    const availableActions = botState.availableActions as PlayerAction[];

    if (availableActions.length === 0) return;

    // Simuler un temps de réflexion
    const thinkingTime = bot.getThinkingTime();

    const timer = setTimeout(() => {
      this.botActionTimers.delete(currentPlayerId);

      // Re-vérifier que c'est toujours au bot de jouer
      const currentState = table.getState();
      if (currentState.currentPlayerId !== currentPlayerId) {
        return;
      }

      // Décider de l'action
      const decision = bot.decideAction(table.getState(currentPlayerId), availableActions);

      console.log(`Bot ${bot.getUsername()} decides: ${decision.action}${decision.amount ? ` (${decision.amount})` : ''}`);

      // Exécuter l'action
      const success = table.executeAction(currentPlayerId, decision.action, decision.amount);

      if (success) {
        // Notifier tous les joueurs de l'action
        io.to(`table:${tableId}`).emit('game:action-made', {
          odId: currentPlayerId,
          action: decision.action,
          amount: decision.amount,
        });

        // Envoyer l'état mis à jour à chaque joueur individuellement
        const newState = table.getState();
        console.log(`=== BOT ACTION COMPLETE, sending state updates ===`);
        console.log(`New currentPlayerId: ${newState.currentPlayerId}`);
        for (const player of newState.players) {
          // Trouver le socket du joueur
          for (const [, socket] of io.sockets.sockets) {
            if ((socket as any).userId === player.odId) {
              const playerState = table.getState(player.odId);
              console.log(`Sending to ${player.username}: actions=[${playerState.availableActions.join(', ')}]`);
              socket.emit('game:state-update', playerState);
              break;
            }
          }
        }

        // Callback si fourni
        if (onActionComplete) {
          onActionComplete();
        }

        // Vérifier si c'est encore au tour d'un bot et relancer
        if (newState.currentPlayerId && this.isBot(newState.currentPlayerId)) {
          setTimeout(() => {
            this.processBotTurn(table, tableId, io);
          }, 1000);
        } else if (newState.currentPlayerId && !this.isBot(newState.currentPlayerId)) {
          // C'est au tour d'un joueur humain, démarrer le timer
          turnTimerManager.startTimer({
            tableId,
            playerId: newState.currentPlayerId,
            timeoutSeconds: newState.turnTimeout,
            io,
            onTimeout: async () => {
              const playerId = newState.currentPlayerId!;
              const player = newState.players.find(p => p.odId === playerId);

              // Incrémenter le compteur d'auto-folds consécutifs
              const consecutiveTimeouts = table.incrementConsecutiveTimeouts(playerId);
              console.log(`[AWAY] Player ${player?.username} has ${consecutiveTimeouts} consecutive timeouts`);

              // Vérifier si le joueur doit être marqué comme absent
              if (consecutiveTimeouts >= CONSECUTIVE_TIMEOUTS_THRESHOLD && !awayManager.isAway(playerId)) {
                table.setPlayerAway(playerId);
                awayManager.checkAndMarkAway(
                  playerId,
                  tableId,
                  player?.username || 'Unknown',
                  consecutiveTimeouts,
                  io,
                  // Callback d'exclusion automatique après 5 minutes
                  async () => {
                    const tableForExclusion = table;
                    const playerState = tableForExclusion.getState().players.find(p => p.odId === playerId);
                    if (!playerState) return;

                    // Retirer le joueur de la table
                    const removedPlayer = tableForExclusion.removePlayer(playerState.seatNumber);
                    if (removedPlayer) {
                      // Rendre les jetons au portefeuille
                      await prisma.wallet.update({
                        where: { userId: playerId },
                        data: {
                          balance: { increment: removedPlayer.chipStack },
                          frozenBalance: { decrement: removedPlayer.initialBuyIn },
                        },
                      });
                      console.log(`[AWAY] Auto-excluded ${player?.username} from table ${tableId}, returned ${removedPlayer.chipStack} chips`);
                    }

                    // Notifier tous les joueurs
                    io.to(`table:${tableId}`).emit('player:excluded', {
                      odId: playerId,
                      username: player?.username,
                      reason: 'away_timeout',
                    });
                  }
                );
              }

              console.log(`Auto-fold for player ${playerId} on table ${tableId} (timeout from bot turn)`);
              const success = table.executeAction(playerId, 'fold');
              if (success) {
                io.to(`table:${tableId}`).emit('game:action-made', {
                  odId: playerId,
                  action: 'fold',
                  isTimeout: true,
                });
                const nextState = table.getState();
                for (const p of nextState.players) {
                  for (const [, s] of io.sockets.sockets) {
                    if ((s as any).userId === p.odId) {
                      s.emit('game:state-update', table.getState(p.odId));
                      break;
                    }
                  }
                }
                // Vérifier si c'est au tour d'un bot
                if (nextState.currentPlayerId && this.isBot(nextState.currentPlayerId)) {
                  setTimeout(() => this.processBotTurn(table, tableId, io), 1000);
                }
              }
            },
          });
        }
      }
    }, thinkingTime);

    this.botActionTimers.set(currentPlayerId, timer);
  }

  /**
   * Vérifie si un joueur est un bot
   */
  isBot(playerId: string): boolean {
    return this.bots.has(playerId);
  }

  /**
   * Obtient tous les bots d'une table
   */
  getBotsOnTable(tableId: string): BotInstance[] {
    const tableBots: BotInstance[] = [];
    for (const [, instance] of this.bots) {
      if (instance.tableId === tableId) {
        tableBots.push(instance);
      }
    }
    return tableBots;
  }

  /**
   * Retire tous les bots d'une table
   */
  removeAllBotsFromTable(tableId: string, table: PokerTable): void {
    const botsToRemove = this.getBotsOnTable(tableId);
    for (const botInstance of botsToRemove) {
      this.removeBotFromTable(botInstance.bot.getId(), table);
    }
  }
}

// Instance singleton
export const botManager = new BotManager();
