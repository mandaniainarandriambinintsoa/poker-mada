import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { prisma } from '../config/database';
import { PokerTable } from '../game/Table';
import { TABLE_CONFIGS } from '../shared/constants/tables';
import { botManager } from '../game/BotManager';
import { turnTimerManager } from '../game/TurnTimer';
import { awayManager, CONSECUTIVE_TIMEOUTS_THRESHOLD } from '../game/AwayManager';
import { setActivePlayersProvider, startPeriodicReconciliation } from '../services/reconciliationService';

// Variable globale pour l'instance io (pour les bots)
// Force reload: 2026-01-25 v2
let ioInstance: Server;

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

// Tables de poker actives
const activeTables: Map<string, PokerTable> = new Map();

// Mapping joueur -> table
const playerTables: Map<string, string> = new Map();

/**
 * Retourne l'ensemble des IDs des joueurs actuellement sur une table
 * Utilisé par le service de réconciliation
 */
export function getActivePlayers(): Set<string> {
  return new Set(playerTables.keys());
}

// Timers de déconnexion (délai de grâce pour les reconnexions)
const disconnectTimers: Map<string, NodeJS.Timeout> = new Map();
const DISCONNECT_GRACE_PERIOD_MS = 30000; // 30 secondes de grâce

// === Chat Global & Utilisateurs en ligne ===
interface OnlineUserInfo {
  odId: string;
  username: string;
  avatar?: string;
  status: 'lobby' | 'playing';
  tableId?: string;
  socketId: string;
}

const onlineUsers: Map<string, OnlineUserInfo> = new Map();
const globalChatMessages: { id: string; odId: string; username: string; avatar?: string; message: string; timestamp: number }[] = [];
const MAX_CHAT_HISTORY = 50; // Garder les 50 derniers messages

// Fonction pour obtenir la liste des utilisateurs en ligne
function getOnlineUsersList(): OnlineUserInfo[] {
  return Array.from(onlineUsers.values());
}

// Gestionnaire du chat global
function handleGlobalChatMessage(
  io: Server,
  socket: AuthenticatedSocket,
  data: { message: string }
): void {
  const { message } = data;

  // Filtrer les messages (longueur max, pas de spam, etc.)
  if (!message || message.length > 500) return;

  const userInfo = onlineUsers.get(socket.userId!);

  const chatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    odId: socket.userId!,
    username: socket.username!,
    avatar: userInfo?.avatar,
    message: message.trim(),
    timestamp: Date.now(),
  };

  // Ajouter au historique
  globalChatMessages.push(chatMessage);

  // Garder seulement les derniers messages
  if (globalChatMessages.length > MAX_CHAT_HISTORY) {
    globalChatMessages.shift();
  }

  // Diffuser le message à tous les utilisateurs connectés
  io.to('global-chat').emit('global:chat-message', chatMessage);
}

export function initializeSocketManager(io: Server): void {
  // Stocker l'instance io pour les bots
  ioInstance = io;

  // Initialiser le service de réconciliation des balances gelées
  setActivePlayersProvider(getActivePlayers);
  startPeriodicReconciliation();

  // Middleware d'authentification
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Token non fourni'));
      }

      const decoded = jwt.verify(token, config.jwt.secret) as { userId: string; email: string };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true, isActive: true, isBanned: true },
      });

      if (!user || !user.isActive || user.isBanned) {
        return next(new Error('Utilisateur non autorisé'));
      }

      socket.userId = user.id;
      socket.username = user.username;
      next();
    } catch (error) {
      next(new Error('Token invalide'));
    }
  });

  // Initialiser les tables
  initializeTables();

  io.on('connection', async (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.username} (${socket.userId})`);

    // Vérifier si c'est une reconnexion (joueur déjà à une table)
    let existingTableId = playerTables.get(socket.userId!);
    let isReconnecting = !!existingTableId;

    // Annuler tout timer de déconnexion en cours pour ce joueur (reconnexion)
    const existingTimer = disconnectTimers.get(socket.userId!);
    if (existingTimer) {
      clearTimeout(existingTimer);
      disconnectTimers.delete(socket.userId!);
      console.log(`[RECONNECT] Cancelled disconnect timer for ${socket.username}`);
    }

    // Si le joueur était à une table, vérifier qu'il y est vraiment encore
    if (existingTableId) {
      const table = activeTables.get(existingTableId);
      if (table) {
        const state = table.getState();
        const playerInTable = state.players.find(p => p.odId === socket.userId);
        if (!playerInTable) {
          // Le joueur a été exclu de la table mais playerTables n'a pas été nettoyé
          console.log(`[RECONNECT] ${socket.username} was in playerTables but not in actual table, cleaning up`);
          playerTables.delete(socket.userId!);
          existingTableId = undefined;
          isReconnecting = false;
        }
      } else {
        // La table n'existe plus
        console.log(`[RECONNECT] Table ${existingTableId} no longer exists, cleaning up`);
        playerTables.delete(socket.userId!);
        existingTableId = undefined;
        isReconnecting = false;
      }
    }

    // Si le joueur était à une table (et y est vraiment), le remettre dans la room socket
    if (existingTableId) {
      socket.join(`table:${existingTableId}`);
      console.log(`[RECONNECT] ${socket.username} rejoined table room ${existingTableId}`);
    }

    // === Chat Global: Ajouter l'utilisateur en ligne ===
    const user = await prisma.user.findUnique({
      where: { id: socket.userId },
      select: { avatar: true },
    });

    const userInfo: OnlineUserInfo = {
      odId: socket.userId!,
      username: socket.username!,
      avatar: user?.avatar || undefined,
      status: isReconnecting ? 'playing' : 'lobby',
      tableId: existingTableId,
      socketId: socket.id,
    };
    onlineUsers.set(socket.userId!, userInfo);

    // Rejoindre la room du chat global
    socket.join('global-chat');

    // Notifier tout le monde du nouvel utilisateur
    io.to('global-chat').emit('users:update', getOnlineUsersList());

    // Si le joueur est déjà à une table (reconnexion), le rediriger
    if (isReconnecting && existingTableId) {
      console.log(`[RECONNECT] ${socket.username} is already at table ${existingTableId}, sending redirect`);
      socket.emit('player:already-at-table', { tableId: existingTableId });
    } else {
      // Envoyer automatiquement les tables lors de la connexion
      socket.join('lobby');
      emitTablesUpdate(socket);
    }

    // === Handlers Chat Global ===
    socket.on('global:get-users', () => {
      socket.emit('users:list', getOnlineUsersList());
    });

    socket.on('global:get-messages', () => {
      socket.emit('global:messages-history', globalChatMessages);
    });

    socket.on('global:chat-send', (data: { message: string }) => {
      handleGlobalChatMessage(io, socket, data);
    });

    // Rejoindre le lobby
    socket.on('lobby:join', () => {
      console.log(`[LOBBY] ${socket.username} joined lobby`);
      socket.join('lobby');

      // Vérifier si le joueur est déjà à une table
      let existingTableId = playerTables.get(socket.userId!);
      if (existingTableId) {
        // Vérifier que le joueur est vraiment dans la table
        const table = activeTables.get(existingTableId);
        if (table) {
          const state = table.getState();
          const playerInTable = state.players.find(p => p.odId === socket.userId);
          if (playerInTable) {
            console.log(`[LOBBY] ${socket.username} is already at table ${existingTableId}, redirecting`);
            socket.emit('player:already-at-table', { tableId: existingTableId });
            return;
          } else {
            // Le joueur a été exclu, nettoyer
            console.log(`[LOBBY] ${socket.username} was in playerTables but not in table, cleaning up`);
            playerTables.delete(socket.userId!);
          }
        } else {
          // La table n'existe plus
          console.log(`[LOBBY] Table ${existingTableId} no longer exists, cleaning up`);
          playerTables.delete(socket.userId!);
        }
      }

      emitTablesUpdate(socket);
    });

    socket.on('lobby:leave', () => {
      console.log(`[LOBBY] ${socket.username} left lobby`);
      socket.leave('lobby');
    });

    socket.on('lobby:get-tables', () => {
      console.log(`[LOBBY] ${socket.username} requested tables`);
      emitTablesUpdate(socket);
    });

    // Rejoindre une table
    socket.on('table:join', async (data: { tableId: string; buyIn: number }) => {
      await handleJoinTable(io, socket, data);
    });

    // Quitter une table
    socket.on('table:leave', async (data: { tableId: string }) => {
      await handleLeaveTable(io, socket, data);
    });

    // Demander l'état actuel d'une table
    socket.on('table:get-state', (data: { tableId: string }) => {
      handleGetTableState(socket, data);
    });

    // Action de jeu
    socket.on('game:action', (data: { tableId: string; action: any; amount?: number }) => {
      handleGameAction(io, socket, data);
    });

    // Chat
    socket.on('chat:send', (data: { tableId: string; message: string }) => {
      handleChatMessage(io, socket, data);
    });

    // Ping/Pong
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // Joueur revient après avoir été marqué comme absent
    socket.on('player:return', (data: { tableId: string }) => {
      handlePlayerReturn(io, socket, data);
    });

    // Déconnexion
    socket.on('disconnect', () => {
      handleDisconnect(io, socket);
      console.log(`User disconnected: ${socket.username}`);
    });
  });
}

function initializeTables(): void {
  for (const config of TABLE_CONFIGS) {
    const tableId = config.id;
    const table = new PokerTable({
      id: tableId,
      name: config.name,
      smallBlind: config.smallBlind,
      bigBlind: config.bigBlind,
      minBuyIn: config.minBuyIn,
      maxBuyIn: config.maxBuyIn,
      maxPlayers: config.maxPlayers,
      turnTimeout: config.turnTimeout,
    });

    // Configurer le callback pour nouvelle main
    table.setOnNewHandCallback(() => {
      console.log(`=== NEW HAND CALLBACK for table ${tableId} ===`);

      // Envoyer l'état à tous les joueurs
      const state = table.getState();
      for (const player of state.players) {
        const playerSocket = findSocketByUserId(ioInstance, player.odId);
        if (playerSocket) {
          const playerState = table.getState(player.odId);
          console.log(`New hand: sending to ${player.username}, actions=[${playerState.availableActions.join(', ')}]`);
          playerSocket.emit('game:state-update', playerState);
        }
      }

      // Démarrer le timer pour le joueur actuel (humain)
      if (state.currentPlayerId && !botManager.isBot(state.currentPlayerId)) {
        startTurnTimerForCurrentPlayer(table, tableId);
      }

      // Déclencher le bot si c'est son tour
      if (state.currentPlayerId && botManager.isBot(state.currentPlayerId)) {
        setTimeout(() => {
          botManager.processBotTurn(table, tableId, ioInstance);
        }, 1000);
      }
    });

    activeTables.set(tableId, table);
  }
  console.log(`Initialized ${activeTables.size} tables`);
}

function emitTablesUpdate(socket: Socket): void {
  const tables = TABLE_CONFIGS.map((config) => {
    const table = activeTables.get(config.id);
    return {
      ...config,
      currentPlayers: table ? getPlayerCount(config.id) : 0,
      isActive: true,
    };
  });

  console.log(`[LOBBY] Emitting tables-update to socket, ${tables.length} tables`);
  socket.emit('lobby:tables-update', tables);
}

function getPlayerCount(tableId: string): number {
  let count = 0;
  for (const [, tId] of playerTables) {
    if (tId === tableId) count++;
  }
  return count;
}

// Démarrer le timer pour le joueur actuel
function startTurnTimerForCurrentPlayer(table: PokerTable, tableId: string): void {
  const state = table.getState();

  // Ne pas démarrer de timer si pas de joueur actuel ou si c'est un bot
  if (!state.currentPlayerId || botManager.isBot(state.currentPlayerId)) {
    turnTimerManager.clearTableTimers(tableId);
    return;
  }

  const playerId = state.currentPlayerId;
  const player = state.players.find(p => p.odId === playerId);

  // Démarrer le timer pour le joueur humain
  turnTimerManager.startTimer({
    tableId,
    playerId,
    timeoutSeconds: state.turnTimeout,
    io: ioInstance,
    onTimeout: () => {
      // Auto-fold quand le temps expire
      console.log(`Auto-fold for player ${playerId} on table ${tableId} (timeout)`);

      const currentTable = activeTables.get(tableId);
      if (!currentTable) return;

      // Incrémenter le compteur d'auto-folds consécutifs
      const consecutiveTimeouts = currentTable.incrementConsecutiveTimeouts(playerId);
      console.log(`[AWAY] Player ${player?.username} has ${consecutiveTimeouts} consecutive timeouts`);

      // Vérifier si le joueur doit être marqué comme absent
      if (consecutiveTimeouts >= CONSECUTIVE_TIMEOUTS_THRESHOLD && !awayManager.isAway(playerId)) {
        currentTable.setPlayerAway(playerId);
        awayManager.checkAndMarkAway(
          playerId,
          tableId,
          player?.username || 'Unknown',
          consecutiveTimeouts,
          ioInstance,
          // Callback d'exclusion automatique après 5 minutes
          async () => {
            const tableForExclusion = activeTables.get(tableId);
            if (!tableForExclusion) return;

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

            // Supprimer la relation joueur-table
            playerTables.delete(playerId);
            updateUserStatus(playerId, 'lobby', undefined);

            // Notifier tous les joueurs
            ioInstance.to(`table:${tableId}`).emit('player:excluded', {
              odId: playerId,
              username: player?.username,
              reason: 'away_timeout',
            });

            // Mettre à jour le lobby
            ioInstance.to('lobby').emit('lobby:tables-update', getTablesInfo());
          }
        );
      }

      // Exécuter l'action fold automatiquement
      const success = currentTable.executeAction(playerId, 'fold');
      if (success) {
        // Notifier tous les joueurs
        ioInstance.to(`table:${tableId}`).emit('game:action-made', {
          odId: playerId,
          action: 'fold',
          isTimeout: true,
        });

        // Envoyer l'état mis à jour
        const newState = currentTable.getState();
        for (const p of newState.players) {
          const playerSocket = findSocketByUserId(ioInstance, p.odId);
          if (playerSocket) {
            playerSocket.emit('game:state-update', currentTable.getState(p.odId));
          }
        }

        // Démarrer le timer pour le prochain joueur
        startTurnTimerForCurrentPlayer(currentTable, tableId);

        // Vérifier si c'est au tour d'un bot
        const nextState = currentTable.getState();
        if (nextState.currentPlayerId && botManager.isBot(nextState.currentPlayerId)) {
          setTimeout(() => {
            botManager.processBotTurn(currentTable, tableId, ioInstance);
          }, 1000);
        }
      }
    },
  });
}

async function handleJoinTable(
  io: Server,
  socket: AuthenticatedSocket,
  data: { tableId: string; buyIn: number }
): Promise<void> {
  const { tableId, buyIn } = data;
  const userId = socket.userId!;
  const username = socket.username!;

  try {
    // Vérifier si le joueur est déjà à une table
    if (playerTables.has(userId)) {
      socket.emit('table:error', { message: 'Vous êtes déjà à une table', code: 'ALREADY_AT_TABLE' });
      return;
    }

    // Récupérer la table
    const table = activeTables.get(tableId);
    if (!table) {
      socket.emit('table:error', { message: 'Table non trouvée', code: 'TABLE_NOT_FOUND' });
      return;
    }

    // Vérifier le solde
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || Number(wallet.balance) - Number(wallet.frozenBalance) < buyIn) {
      socket.emit('table:error', { message: 'Solde insuffisant', code: 'INSUFFICIENT_BALANCE' });
      return;
    }

    // Trouver un siège libre
    const tableConfig = TABLE_CONFIGS.find((t) => t.id === tableId)!;
    let seatNumber = -1;
    for (let i = 0; i < tableConfig.maxPlayers; i++) {
      const state = table.getState();
      if (!state.players.find((p) => p.seatNumber === i)) {
        seatNumber = i;
        break;
      }
    }

    if (seatNumber === -1) {
      socket.emit('table:error', { message: 'Table pleine', code: 'TABLE_FULL' });
      return;
    }

    // Déduire le buy-in du portefeuille
    await prisma.wallet.update({
      where: { userId },
      data: {
        balance: { decrement: buyIn },
        frozenBalance: { increment: buyIn },
      },
    });

    // Ajouter le joueur à la table
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    table.addPlayer(userId, username, seatNumber, buyIn, user?.avatar || undefined);

    // Enregistrer la relation joueur-table
    playerTables.set(userId, tableId);

    // Mettre à jour le status de l'utilisateur (Chat Global)
    updateUserStatus(userId, 'playing', tableId);

    // Rejoindre la room socket
    socket.join(`table:${tableId}`);

    // Envoyer l'état du jeu au joueur
    const joinedState = table.getState(userId);
    console.log(`=== SENDING table:joined to ${username} ===`);
    console.log(`Phase: ${joinedState.phase}, CurrentPlayerId: ${joinedState.currentPlayerId}`);
    console.log(`AvailableActions: [${joinedState.availableActions.join(', ')}]`);
    socket.emit('table:joined', {
      tableId,
      gameState: joinedState,
    });

    // Notifier les autres joueurs
    socket.to(`table:${tableId}`).emit('table:player-joined', {
      player: {
        odId: userId,
        username,
        seatNumber,
        chipStack: buyIn,
        avatar: user?.avatar,
      },
    });

    // Mettre à jour le lobby
    io.to('lobby').emit('lobby:tables-update', getTablesInfo());

    console.log(`${username} joined table ${tableId} at seat ${seatNumber}`);

    // === BOT POUR TESTS ===
    // Ajouter un bot si c'est le seul joueur (pour pouvoir tester)
    const currentPlayerCount = table.getState().players.length;
    if (currentPlayerCount === 1) {
      // Ajouter un bot après un court délai
      setTimeout(() => {
        const tableConfig = TABLE_CONFIGS.find(t => t.id === tableId);
        if (tableConfig) {
          const bot = botManager.addBotToTable(table, tableId, tableConfig.minBuyIn, io);
          if (bot) {
            // Envoyer l'état mis à jour à chaque joueur individuellement
            const updatedState = table.getState();
            for (const player of updatedState.players) {
              const playerSocket = findSocketByUserId(io, player.odId);
              if (playerSocket) {
                playerSocket.emit('game:state-update', table.getState(player.odId));
              }
            }
            io.to('lobby').emit('lobby:tables-update', getTablesInfo());

            // Lancer le tour du bot si c'est à lui
            setTimeout(() => {
              botManager.processBotTurn(table, tableId, io);
            }, 1000);
          }
        }
      }, 2000);
    } else {
      // Vérifier si un bot doit jouer
      const currentState = table.getState();
      if (currentState.currentPlayerId && botManager.isBot(currentState.currentPlayerId)) {
        setTimeout(() => {
          botManager.processBotTurn(table, tableId, io);
        }, 1000);
      }
    }
    // === FIN BOT ===
  } catch (error) {
    console.error('Error joining table:', error);
    socket.emit('table:error', { message: 'Erreur lors de la connexion', code: 'JOIN_ERROR' });
  }
}

async function handleLeaveTable(
  io: Server,
  socket: AuthenticatedSocket,
  data: { tableId: string; forceFold?: boolean }
): Promise<void> {
  const { tableId, forceFold } = data;
  const userId = socket.userId!;

  try {
    const table = activeTables.get(tableId);
    if (!table) return;

    // Trouver le joueur et son siège
    const state = table.getState(userId);
    const playerInfo = state.players.find((p) => p.odId === userId);
    if (!playerInfo) return;

    // Vérifier si le joueur peut quitter selon les règles du poker
    const leaveCheck = table.canPlayerLeave(userId);
    if (!leaveCheck.canLeave) {
      // Si forceFold est demandé et le joueur est dans une main active
      if (forceFold && state.phase !== 'waiting' && state.phase !== 'showdown') {
        // Forcer le fold du joueur
        table.forcePlayerFold(userId);
        console.log(`[LEAVE] ${socket.username} forced fold before leaving table ${tableId}`);

        // Notifier les autres du fold
        io.to(`table:${tableId}`).emit('game:action-made', {
          odId: userId,
          action: 'fold',
          isLeaving: true,
        });

        // Envoyer l'état mis à jour
        const newState = table.getState();
        for (const p of newState.players) {
          const playerSocket = findSocketByUserId(io, p.odId);
          if (playerSocket) {
            playerSocket.emit('game:state-update', table.getState(p.odId));
          }
        }
      } else {
        // Refuser le départ
        socket.emit('table:leave-denied', {
          reason: leaveCheck.reason,
          canForceFold: state.phase !== 'waiting' && state.phase !== 'showdown' && !playerInfo.isFolded,
        });
        console.log(`[LEAVE] ${socket.username} denied leaving table ${tableId}: ${leaveCheck.reason}`);
        return;
      }
    }

    // Retirer le joueur de la table
    const player = table.removePlayer(playerInfo.seatNumber);
    if (!player) return;

    // Rendre les jetons au portefeuille
    // On utilise initialBuyIn pour le frozenBalance (ce qui a été gelé)
    // et chipStack pour le balance (ce que le joueur repart avec)
    await prisma.wallet.update({
      where: { userId },
      data: {
        balance: { increment: player.chipStack },
        frozenBalance: { decrement: player.initialBuyIn },
      },
    });

    // Supprimer la relation joueur-table
    playerTables.delete(userId);

    // Mettre à jour le status de l'utilisateur (Chat Global)
    updateUserStatus(userId, 'lobby', undefined);

    // Quitter la room socket
    socket.leave(`table:${tableId}`);

    // Notifier le joueur
    socket.emit('table:left', { tableId });

    // Notifier les autres joueurs
    io.to(`table:${tableId}`).emit('table:player-left', {
      odId: userId,
      seatNumber: playerInfo.seatNumber,
    });

    // Mettre à jour le lobby
    io.to('lobby').emit('lobby:tables-update', getTablesInfo());

    console.log(`${socket.username} left table ${tableId}`);
  } catch (error) {
    console.error('Error leaving table:', error);
  }
}

function handleGameAction(
  io: Server,
  socket: AuthenticatedSocket,
  data: { tableId: string; action: any; amount?: number }
): void {
  const { tableId, action, amount } = data;
  const userId = socket.userId!;

  const table = activeTables.get(tableId);
  if (!table) {
    socket.emit('table:error', { message: 'Table non trouvée', code: 'TABLE_NOT_FOUND' });
    return;
  }

  // Arrêter le timer du joueur actuel
  turnTimerManager.clearTableTimers(tableId);

  // Réinitialiser le compteur d'auto-folds (le joueur a joué manuellement)
  table.resetConsecutiveTimeouts(userId);

  // Si le joueur était marqué comme absent, le remettre en jeu
  if (awayManager.isAway(userId)) {
    awayManager.playerReturned(userId, io);
    table.setPlayerReturned(userId);
  }

  const success = table.executeAction(userId, action, amount);

  if (!success) {
    socket.emit('table:error', { message: 'Action invalide', code: 'INVALID_ACTION' });
    return;
  }

  // Notifier tous les joueurs de l'action
  io.to(`table:${tableId}`).emit('game:action-made', {
    odId: userId,
    action,
    amount,
  });

  // Envoyer l'état mis à jour à tous les joueurs
  const state = table.getState();
  for (const player of state.players) {
    const playerSocket = findSocketByUserId(io, player.odId);
    if (playerSocket) {
      playerSocket.emit('game:state-update', table.getState(player.odId));
    }
  }

  // Si c'est le tour d'un nouveau joueur, le notifier
  if (state.currentPlayerId) {
    const currentPlayerSocket = findSocketByUserId(io, state.currentPlayerId);
    if (currentPlayerSocket) {
      currentPlayerSocket.emit('game:your-turn', {
        availableActions: state.availableActions,
        minRaise: state.minRaise,
        maxRaise: state.players.find((p) => p.odId === state.currentPlayerId)?.chipStack || 0,
        timeRemaining: state.turnTimeout,
      });
    }

    // Démarrer le timer pour le prochain joueur (humain)
    if (!botManager.isBot(state.currentPlayerId)) {
      startTurnTimerForCurrentPlayer(table, tableId);
    }

    // === BOT: Vérifier si c'est au tour d'un bot ===
    const nextState = table.getState();
    if (nextState.currentPlayerId && botManager.isBot(nextState.currentPlayerId)) {
      setTimeout(() => {
        botManager.processBotTurn(table, tableId, io);
      }, 1000);
    }
  }
}

function handleGetTableState(
  socket: AuthenticatedSocket,
  data: { tableId: string }
): void {
  const { tableId } = data;
  const userId = socket.userId!;

  const table = activeTables.get(tableId);
  if (!table) {
    socket.emit('table:error', { message: 'Table non trouvée', code: 'TABLE_NOT_FOUND' });
    return;
  }

  // Vérifier si le joueur est à cette table (dans playerTables)
  const currentTableId = playerTables.get(userId);
  if (currentTableId !== tableId) {
    socket.emit('table:error', { message: 'Vous n\'êtes pas à cette table', code: 'NOT_AT_TABLE' });
    return;
  }

  // Vérifier que le joueur est vraiment dans la table (pas exclu)
  const state = table.getState();
  const playerInTable = state.players.find(p => p.odId === userId);
  if (!playerInTable) {
    // Le joueur a été exclu, nettoyer et rediriger
    console.log(`[TABLE:GET-STATE] ${socket.username} was in playerTables but not in table, cleaning up`);
    playerTables.delete(userId);
    socket.emit('table:error', { message: 'Vous avez été exclu de cette table', code: 'EXCLUDED_FROM_TABLE' });
    socket.emit('table:left', { tableId });
    return;
  }

  // Envoyer l'état de la table
  socket.emit('table:state', {
    tableId,
    gameState: table.getState(userId),
  });
}

function handleChatMessage(
  io: Server,
  socket: AuthenticatedSocket,
  data: { tableId: string; message: string }
): void {
  const { tableId, message } = data;

  // Filtrer les messages (longueur max, pas de spam, etc.)
  if (message.length > 200) return;

  io.to(`table:${tableId}`).emit('chat:message', {
    odId: socket.userId!,
    username: socket.username!,
    message,
    timestamp: Date.now(),
  });
}

async function handleDisconnect(io: Server, socket: AuthenticatedSocket): Promise<void> {
  const userId = socket.userId;
  const username = socket.username;
  if (!userId) return;

  // === Chat Global: Retirer l'utilisateur de la liste en ligne ===
  onlineUsers.delete(userId);
  io.to('global-chat').emit('users:update', getOnlineUsersList());

  const tableId = playerTables.get(userId);
  if (tableId) {
    // Au lieu de retirer immédiatement, on démarre un timer de grâce
    // pour permettre au joueur de se reconnecter (navigation entre pages, etc.)
    console.log(`[DISCONNECT] ${username} disconnected from table ${tableId}, starting ${DISCONNECT_GRACE_PERIOD_MS / 1000}s grace period`);

    const disconnectTimer = setTimeout(async () => {
      // Le timer a expiré, retirer vraiment le joueur
      disconnectTimers.delete(userId);

      try {
        const table = activeTables.get(tableId);
        if (table) {
          // Trouver le joueur
          const state = table.getState(userId);
          const playerInfo = state.players.find((p) => p.odId === userId);

          if (playerInfo) {
            // Retirer le joueur de la table
            const player = table.removePlayer(playerInfo.seatNumber);

            if (player) {
              // Rendre les jetons au portefeuille
              // On utilise initialBuyIn pour le frozenBalance (ce qui a été gelé)
              // et chipStack pour le balance (ce que le joueur repart avec)
              await prisma.wallet.update({
                where: { userId },
                data: {
                  balance: { increment: player.chipStack },
                  frozenBalance: { decrement: player.initialBuyIn },
                },
              });
              console.log(`[DISCONNECT] Grace period expired. Returned ${player.chipStack} chips to ${username} (frozen: ${player.initialBuyIn})`);
            }
          }
        }

        // Supprimer la relation joueur-table
        playerTables.delete(userId);

        // Notifier les autres joueurs
        io.to(`table:${tableId}`).emit('table:player-left', {
          odId: userId,
          seatNumber: -1,
        });

        // Mettre à jour le lobby
        io.to('lobby').emit('lobby:tables-update', getTablesInfo());

        console.log(`[DISCONNECT] Player ${username} removed from table ${tableId} after grace period`);
      } catch (error) {
        console.error('Error handling disconnect after grace period:', error);
      }
    }, DISCONNECT_GRACE_PERIOD_MS);

    disconnectTimers.set(userId, disconnectTimer);
  }
}

function findSocketByUserId(io: Server, odId: string): AuthenticatedSocket | null {
  for (const [, socket] of io.sockets.sockets) {
    if ((socket as AuthenticatedSocket).userId === odId) {
      return socket as AuthenticatedSocket;
    }
  }
  return null;
}

function getTablesInfo() {
  return TABLE_CONFIGS.map((config) => ({
    ...config,
    currentPlayers: getPlayerCount(config.id),
    isActive: true,
  }));
}

function updateUserStatus(userId: string, status: 'lobby' | 'playing', tableId?: string): void {
  const user = onlineUsers.get(userId);
  if (user) {
    user.status = status;
    user.tableId = tableId;
    ioInstance.to('global-chat').emit('users:update', getOnlineUsersList());
  }
}

// Gérer le retour d'un joueur marqué comme absent
function handlePlayerReturn(
  io: Server,
  socket: AuthenticatedSocket,
  data: { tableId: string }
): void {
  const { tableId } = data;
  const userId = socket.userId!;

  const table = activeTables.get(tableId);
  if (!table) {
    socket.emit('table:error', { message: 'Table non trouvée', code: 'TABLE_NOT_FOUND' });
    return;
  }

  // Vérifier si le joueur est marqué comme absent
  if (!awayManager.isAway(userId)) {
    socket.emit('player:return-error', { message: 'Vous n\'êtes pas marqué comme absent' });
    return;
  }

  // Annuler le timer d'exclusion et marquer le joueur comme revenu
  const returned = awayManager.playerReturned(userId, io);
  if (returned) {
    table.setPlayerReturned(userId);

    // Envoyer l'état mis à jour à tous les joueurs
    const state = table.getState();
    for (const player of state.players) {
      const playerSocket = findSocketByUserId(io, player.odId);
      if (playerSocket) {
        playerSocket.emit('game:state-update', table.getState(player.odId));
      }
    }

    socket.emit('player:return-success', { message: 'Bienvenue de retour!' });
    console.log(`[AWAY] Player ${socket.username} returned to table ${tableId}`);
  }
}

export { activeTables, playerTables };
