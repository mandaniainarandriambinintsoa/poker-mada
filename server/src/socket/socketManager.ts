import { walletService } from '../services/walletService';
import { AppError } from '../middleware/errorHandler';
import { socketContracts } from './contracts';
import { queueTable } from './tableQueue';
import { PlayerAction } from '../shared/types/game';
import { Server, Socket } from 'socket.io';
import { config } from '../config/env';
import { prisma } from '../config/database';
import { verifyAccessToken } from '../security/tokens';
import { PokerTable } from '../game/Table';
import { TABLE_CONFIGS } from '../shared/constants/tables';
import { botManager } from '../game/BotManager';
import { turnTimerManager } from '../game/TurnTimer';
import { awayManager, CONSECUTIVE_TIMEOUTS_THRESHOLD } from '../game/AwayManager';
import {
  setActivePlayersProvider,
  startPeriodicReconciliation,
} from '../services/reconciliationService';

const debugLog = (...args: unknown[]): void => {
  if (config.nodeEnv !== 'production') console.log(...args);
};

// Variable globale pour l'instance io (pour les bots)
// Force reload: 2026-01-25 v2
let ioInstance: Server;

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  avatar?: string;
  tokenExpiresAt?: number;
}

// Tables de poker actives
const activeTables: Map<string, PokerTable> = new Map();

// Mapping joueur -> table
const playerTables: Map<string, string> = new Map();
const tableReservations = new Map<string, { id: string; tableId: string }>();
const pendingSettlements = new Map<string, { tableId: string; chipStack: number }>();
async function returnChips(userId: string, tableId: string, chipStack: number) {
  const reservation = tableReservations.get(userId);
  if (!reservation || reservation.tableId !== tableId) throw new Error('Missing table reservation');
  pendingSettlements.set(userId, { tableId, chipStack });
  for (let attempt = 0; ; attempt++) {
    try {
      await walletService.settleTable(userId, tableId, reservation.id, chipStack);
      tableReservations.delete(userId);
      pendingSettlements.delete(userId);
      return;
    } catch (error) {
      if (attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
}

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
const SOCKET_AUTH_RECHECK_MS = 30_000;

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
const globalChatMessages: {
  id: string;
  odId: string;
  username: string;
  avatar?: string;
  message: string;
  timestamp: number;
}[] = [];
const MAX_CHAT_HISTORY = 50; // Garder les 50 derniers messages

// Fonction pour obtenir la liste des utilisateurs en ligne
function getOnlineUsersList(): OnlineUserInfo[] {
  return Array.from(onlineUsers.values());
}

// Gestionnaire du chat global
function handleGlobalChatMessage(
  io: Server,
  socket: AuthenticatedSocket,
  data: { message: string },
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

  botManager.setHumanPlayerSettlementHandler(async (playerId, tableId, chipStack) => {
    await returnChips(playerId, tableId, chipStack);
    playerTables.delete(playerId);
    updateUserStatus(playerId, 'lobby', undefined);
  });

  // Initialiser le service de réconciliation des balances gelées
  setActivePlayersProvider(getActivePlayers);
  startPeriodicReconciliation();

  // Middleware d'authentification
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Token non fourni'));
      }

      const decoded = verifyAccessToken(token);

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true, avatar: true, isActive: true, isBanned: true },
      });

      if (!user || !user.isActive || user.isBanned) {
        return next(new Error('Utilisateur non autorisé'));
      }

      socket.userId = user.id;
      socket.username = user.username;
      socket.avatar = user.avatar ?? undefined;
      socket.tokenExpiresAt = decoded.exp * 1000;
      next();
    } catch (error) {
      next(new Error('Token invalide'));
    }
  });

  // Initialiser les tables
  initializeTables();

  io.on('connection', (socket: AuthenticatedSocket) => {
    let windowStart = Date.now();
    let packets = 0;
    let lastChat = 0;
    let lastAuthorizationCheck = Date.now();
    socket.use(async ([event, payload], next) => {
      if (!socket.tokenExpiresAt || Date.now() >= socket.tokenExpiresAt) {
        socket.emit('reconnect-required');
        socket.disconnect(true);
        return;
      }
      if (Date.now() - lastAuthorizationCheck >= SOCKET_AUTH_RECHECK_MS) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: socket.userId },
            select: { isActive: true, isBanned: true },
          });
          if (!user || !user.isActive || user.isBanned) {
            socket.emit('auth:revoked', { code: 'SESSION_REVOKED' });
            socket.disconnect(true);
            return;
          }
          lastAuthorizationCheck = Date.now();
        } catch {
          socket.emit('table:error', {
            message: 'Vérification de session indisponible. Réessayez.',
            code: 'AUTH_CHECK_FAILED',
          });
          return;
        }
      }
      if (Date.now() - windowStart > 1000) {
        windowStart = Date.now();
        packets = 0;
      }
      if (++packets > 30) {
        socket.emit('table:error', {
          message: 'Trop de demandes. Réessayez.',
          code: 'RATE_LIMITED',
        });
        return;
      }
      const schema = socketContracts[event];
      if (schema && !schema.safeParse(payload).success) {
        socket.emit('table:error', { message: 'Demande invalide', code: 'INVALID_INPUT' });
        return;
      }
      if (event === 'global:chat-send' || event === 'chat:send') {
        if (Date.now() - lastChat < 750) {
          socket.emit('table:error', {
            message: 'Patientez avant de renvoyer un message.',
            code: 'RATE_LIMITED',
          });
          return;
        }
        lastChat = Date.now();
      }
      next();
    });
    debugLog('User connected');

    // Vérifier si c'est une reconnexion (joueur déjà à une table)
    let existingTableId = playerTables.get(socket.userId!);
    let isReconnecting = !!existingTableId;

    // Annuler tout timer de déconnexion en cours pour ce joueur (reconnexion)
    const existingTimer = disconnectTimers.get(socket.userId!);
    if (existingTimer) {
      clearTimeout(existingTimer);
      disconnectTimers.delete(socket.userId!);
      debugLog('[RECONNECT] Cancelled disconnect timer');
    }

    // Si le joueur était à une table, vérifier qu'il y est vraiment encore
    if (existingTableId) {
      const table = activeTables.get(existingTableId);
      if (table) {
        const state = table.getState();
        const playerInTable = state.players.find((p) => p.odId === socket.userId);
        if (!playerInTable) {
          // Le joueur a été exclu de la table mais playerTables n'a pas été nettoyé
          debugLog('[RECONNECT] Stale player-table mapping removed');
          playerTables.delete(socket.userId!);
          existingTableId = undefined;
          isReconnecting = false;
        }
      } else {
        // La table n'existe plus
        debugLog('[RECONNECT] Table no longer exists, cleaning up');
        playerTables.delete(socket.userId!);
        existingTableId = undefined;
        isReconnecting = false;
      }
    }

    // Si le joueur était à une table (et y est vraiment), le remettre dans la room socket
    if (existingTableId) {
      socket.join(`table:${existingTableId}`);
      debugLog('[RECONNECT] Player rejoined table room');

      // Redémarrer le timer si c'est le tour de ce joueur
      const table = activeTables.get(existingTableId);
      if (table) {
        const state = table.getState();
        if (state.currentPlayerId === socket.userId && !botManager.isBot(socket.userId!)) {
          debugLog('[RECONNECT] Restarting player timer');
          startTurnTimerForCurrentPlayer(table, existingTableId);
        }
      }
    }

    // === Chat Global: Ajouter l'utilisateur en ligne ===

    const userInfo: OnlineUserInfo = {
      odId: socket.userId!,
      username: socket.username!,
      avatar: socket.avatar,
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
      debugLog('[RECONNECT] Redirecting player to active table');
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
      debugLog('[LOBBY] Player joined');
      socket.join('lobby');

      // Vérifier si le joueur est déjà à une table
      const existingTableId = playerTables.get(socket.userId!);
      if (existingTableId) {
        // Vérifier que le joueur est vraiment dans la table
        const table = activeTables.get(existingTableId);
        if (table) {
          const state = table.getState();
          const playerInTable = state.players.find((p) => p.odId === socket.userId);
          if (playerInTable) {
            debugLog('[LOBBY] Redirecting player to active table');
            socket.emit('player:already-at-table', { tableId: existingTableId });
            return;
          } else {
            // Le joueur a été exclu, nettoyer
            debugLog('[LOBBY] Stale player-table mapping removed');
            playerTables.delete(socket.userId!);
          }
        } else {
          // La table n'existe plus
          debugLog('[LOBBY] Table no longer exists, cleaning up');
          playerTables.delete(socket.userId!);
        }
      }

      emitTablesUpdate(socket);
    });

    socket.on('lobby:leave', () => {
      debugLog('[LOBBY] Player left');
      socket.leave('lobby');
    });

    socket.on('lobby:get-tables', () => {
      debugLog('[LOBBY] Tables requested');
      emitTablesUpdate(socket);
    });

    // Rejoindre une table
    socket.on('table:join', async (data: { tableId: string; buyIn: number }) => {
      await queueTable(data.tableId, () => handleJoinTable(io, socket, data));
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
    socket.on('game:action', (data: { tableId: string; action: PlayerAction; amount?: number }) => {
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
      debugLog('User disconnected');
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
      debugLog('New hand callback');

      // Envoyer l'état à tous les joueurs
      const state = table.getState();
      for (const player of state.players) {
        const playerSocket = findSocketByUserId(ioInstance, player.odId);
        if (playerSocket) {
          const playerState = table.getState(player.odId);
          debugLog(`New hand update, actions=[${playerState.availableActions.join(', ')}]`);
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
  debugLog(`Initialized ${activeTables.size} tables`);
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

  debugLog(`[LOBBY] Emitting ${tables.length} table summaries`);
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
  const player = state.players.find((p) => p.odId === playerId);

  // Démarrer le timer pour le joueur humain
  turnTimerManager.startTimer({
    tableId,
    playerId,
    timeoutSeconds: state.turnTimeout,
    io: ioInstance,
    onTimeout: () => {
      // Auto-fold quand le temps expire
      debugLog('Auto-fold after timeout');

      const currentTable = activeTables.get(tableId);
      if (!currentTable) return;

      // Incrémenter le compteur d'auto-folds consécutifs
      const consecutiveTimeouts = currentTable.incrementConsecutiveTimeouts(playerId);
      debugLog(`[AWAY] Consecutive timeouts: ${consecutiveTimeouts}`);

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

            const playerState = tableForExclusion
              .getState()
              .players.find((p) => p.odId === playerId);
            if (!playerState) return;

            // Retirer le joueur de la table
            const removedPlayer = tableForExclusion.removePlayer(playerState.seatNumber);
            if (removedPlayer) {
              // Rendre les jetons au portefeuille
              await returnChips(playerId, tableId, removedPlayer.chipStack);
              debugLog('[AWAY] Auto-excluded player and returned reserved chips');
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
          },
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
  data: { tableId: string; buyIn: number },
): Promise<void> {
  const { tableId, buyIn } = data;
  const userId = socket.userId!;
  const username = socket.username!;

  try {
    // Vérifier si le joueur est déjà à une table
    if (playerTables.has(userId)) {
      socket.emit('table:error', {
        message: 'Vous êtes déjà à une table',
        code: 'ALREADY_AT_TABLE',
      });
      return;
    }

    // Récupérer la table
    const table = activeTables.get(tableId);
    if (!table) {
      socket.emit('table:error', { message: 'Table non trouvée', code: 'TABLE_NOT_FOUND' });
      return;
    }

    const limits = TABLE_CONFIGS.find((t) => t.id === tableId);
    if (
      !limits ||
      !Number.isSafeInteger(buyIn) ||
      buyIn < limits.minBuyIn ||
      buyIn > limits.maxBuyIn
    ) {
      socket.emit('table:error', { message: 'Montant du buy-in invalide', code: 'INVALID_BUY_IN' });
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

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { avatar: true } });
    const reservation = await walletService.reserveTable(userId, tableId, buyIn);
    tableReservations.set(userId, { id: reservation.id, tableId });
    if (
      !socket.connected ||
      !table.addPlayer(userId, username, seatNumber, buyIn, user?.avatar || undefined)
    ) {
      await returnChips(userId, tableId, buyIn);
      socket.emit('table:error', {
        message: 'La place n’est plus disponible. Aucun jeton débité.',
        code: 'JOIN_FAILED',
      });
      return;
    }

    // Enregistrer la relation joueur-table
    playerTables.set(userId, tableId);

    // Mettre à jour le status de l'utilisateur (Chat Global)
    updateUserStatus(userId, 'playing', tableId);

    // Rejoindre la room socket
    socket.join(`table:${tableId}`);

    // Envoyer l'état du jeu au joueur
    const joinedState = table.getState(userId);
    debugLog('Sending table:joined');
    debugLog(`Phase: ${joinedState.phase}`);
    debugLog(`AvailableActions: [${joinedState.availableActions.join(', ')}]`);
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

    for (const p of table.getState().players)
      findSocketByUserId(io, p.odId)?.emit('game:state-update', table.getState(p.odId));
    debugLog('Table join completed');

    // === BOT POUR TESTS ===
    // Ajouter un bot si c'est le seul joueur (pour pouvoir tester)
    const currentPlayerCount = table.getState().players.length;
    if (config.enableBots && currentPlayerCount === 1) {
      // Ajouter un bot après un court délai
      setTimeout(() => {
        const tableConfig = TABLE_CONFIGS.find((t) => t.id === tableId);
        if (tableConfig && table.getState().players.length === 1) {
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
    socket.emit('table:error', {
      message: error instanceof AppError ? error.message : 'Connexion impossible. Réessayez.',
      code: error instanceof AppError ? error.code : 'JOIN_ERROR',
    });
  }
}

async function handleLeaveTable(
  io: Server,
  socket: AuthenticatedSocket,
  data: { tableId: string; forceFold?: boolean },
): Promise<void> {
  const { tableId, forceFold } = data;
  const userId = socket.userId!;

  try {
    const table = activeTables.get(tableId);
    if (!table) return;

    // Trouver le joueur et son siège
    const state = table.getState(userId);
    const playerInfo = state.players.find((p) => p.odId === userId);
    if (!playerInfo) {
      const pending = pendingSettlements.get(userId);
      if (pending?.tableId === tableId) {
        await returnChips(userId, tableId, pending.chipStack);
        playerTables.delete(userId);
        socket.emit('table:left', { tableId });
      }
      return;
    }

    // Vérifier si le joueur peut quitter selon les règles du poker
    const leaveCheck = table.canPlayerLeave(userId);
    if (!leaveCheck.canLeave) {
      // Si forceFold est demandé et le joueur est dans une main active
      if (forceFold && state.phase !== 'waiting' && state.phase !== 'showdown') {
        // Forcer le fold du joueur
        table.forcePlayerFold(userId);
        debugLog('[LEAVE] Player forced fold before leaving');

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
          canForceFold:
            state.phase !== 'waiting' && state.phase !== 'showdown' && !playerInfo.isFolded,
        });
        debugLog(`[LEAVE] Leave denied: ${leaveCheck.reason}`);
        return;
      }
    }

    // Retirer le joueur de la table
    const player = table.removePlayer(playerInfo.seatNumber);
    if (!player) return;

    // Rendre les jetons au portefeuille
    // On utilise initialBuyIn pour le frozenBalance (ce qui a été gelé)
    // et chipStack pour le balance (ce que le joueur repart avec)
    await returnChips(userId, tableId, player.chipStack);

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

    for (const p of table.getState().players)
      findSocketByUserId(io, p.odId)?.emit('game:state-update', table.getState(p.odId));
  } catch (error) {
    console.error('Table settlement failed');
    socket.emit('table:error', {
      message: 'Retour des jetons en attente. Réessayez de quitter la table.',
      code: 'SETTLEMENT_PENDING',
    });
  }
}

function handleGameAction(
  io: Server,
  socket: AuthenticatedSocket,
  data: { tableId: string; action: PlayerAction; amount?: number },
): void {
  const { tableId, action, amount } = data;
  const userId = socket.userId!;

  const table = activeTables.get(tableId);
  if (!table) {
    socket.emit('table:error', { message: 'Table non trouvée', code: 'TABLE_NOT_FOUND' });
    return;
  }

  // Invalid actions must not stop another player's clock.
  if (playerTables.get(userId) !== tableId || table.getState().currentPlayerId !== userId) {
    socket.emit('table:error', { message: 'Ce n’est pas votre tour', code: 'INVALID_ACTION' });
    return;
  }

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

  turnTimerManager.clearTableTimers(tableId);

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

function handleGetTableState(socket: AuthenticatedSocket, data: { tableId: string }): void {
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
    socket.emit('table:error', { message: "Vous n'êtes pas à cette table", code: 'NOT_AT_TABLE' });
    return;
  }

  // Vérifier que le joueur est vraiment dans la table (pas exclu)
  const state = table.getState();
  const playerInTable = state.players.find((p) => p.odId === userId);
  if (!playerInTable) {
    // Le joueur a été exclu, nettoyer et rediriger
    debugLog('[TABLE:GET-STATE] Stale player-table mapping removed');
    playerTables.delete(userId);
    socket.emit('table:error', {
      message: 'Vous avez été exclu de cette table',
      code: 'EXCLUDED_FROM_TABLE',
    });
    socket.emit('table:left', { tableId });
    return;
  }

  // Envoyer l'état de la table
  socket.emit('table:state', {
    tableId,
    gameState: table.getState(userId),
  });

  // Si c'est le tour de ce joueur, s'assurer que le timer est actif
  if (state.currentPlayerId === userId && !botManager.isBot(userId)) {
    debugLog('[TABLE:GET-STATE] Ensuring timer is running');
    startTurnTimerForCurrentPlayer(table, tableId);
  }
}

function handleChatMessage(
  io: Server,
  socket: AuthenticatedSocket,
  data: { tableId: string; message: string },
): void {
  const { tableId, message } = data;

  // Filtrer les messages (longueur max, pas de spam, etc.)
  if (message.length > 200 || playerTables.get(socket.userId!) !== tableId) return;

  io.to(`table:${tableId}`).emit('chat:message', {
    odId: socket.userId!,
    username: socket.username!,
    message,
    timestamp: Date.now(),
  });
}

async function handleDisconnect(io: Server, socket: AuthenticatedSocket): Promise<void> {
  const userId = socket.userId;
  if (!userId) return;

  const remainingSocket = findSocketByUserId(io, userId);
  if (remainingSocket) {
    const online = onlineUsers.get(userId);
    if (online) online.socketId = remainingSocket.id;
    return;
  }
  const previousTimer = disconnectTimers.get(userId);
  if (previousTimer) clearTimeout(previousTimer);
  // === Chat Global: Retirer l'utilisateur de la liste en ligne ===
  onlineUsers.delete(userId);
  io.to('global-chat').emit('users:update', getOnlineUsersList());

  const tableId = playerTables.get(userId);
  if (tableId) {
    // Au lieu de retirer immédiatement, on démarre un timer de grâce
    // pour permettre au joueur de se reconnecter (navigation entre pages, etc.)
    debugLog(`[DISCONNECT] Starting ${DISCONNECT_GRACE_PERIOD_MS / 1000}s settlement grace period`);

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
              await returnChips(userId, tableId, player.chipStack);
              debugLog('[DISCONNECT] Grace period expired; reserved chips settled');
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

        debugLog('[DISCONNECT] Player removed after grace period');
      } catch (error) {
        console.error(
          JSON.stringify({
            event: 'socket.disconnect_settlement_failed',
            type: error instanceof Error ? error.name : 'UnknownError',
          }),
        );
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
  data: { tableId: string },
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
    socket.emit('player:return-error', { message: "Vous n'êtes pas marqué comme absent" });
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
    debugLog('[AWAY] Player returned to table');
  }
}

export { activeTables, playerTables };
