import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { prisma } from '../config/database';
import { PokerTable } from '../game/Table';
import { TABLE_CONFIGS } from '../shared/constants/tables';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

// Tables de poker actives
const activeTables: Map<string, PokerTable> = new Map();

// Mapping joueur -> table
const playerTables: Map<string, string> = new Map();

export function initializeSocketManager(io: Server): void {
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

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.username} (${socket.userId})`);

    // Rejoindre le lobby
    socket.on('lobby:join', () => {
      socket.join('lobby');
      emitTablesUpdate(socket);
    });

    socket.on('lobby:leave', () => {
      socket.leave('lobby');
    });

    socket.on('lobby:get-tables', () => {
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

    // Déconnexion
    socket.on('disconnect', () => {
      handleDisconnect(io, socket);
      console.log(`User disconnected: ${socket.username}`);
    });
  });
}

function initializeTables(): void {
  for (const config of TABLE_CONFIGS) {
    const table = new PokerTable({
      id: config.id,
      name: config.name,
      smallBlind: config.smallBlind,
      bigBlind: config.bigBlind,
      minBuyIn: config.minBuyIn,
      maxBuyIn: config.maxBuyIn,
      maxPlayers: config.maxPlayers,
      turnTimeout: config.turnTimeout,
    });
    activeTables.set(config.id, table);
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

  socket.emit('lobby:tables-update', tables);
}

function getPlayerCount(tableId: string): number {
  let count = 0;
  for (const [, tId] of playerTables) {
    if (tId === tableId) count++;
  }
  return count;
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

    // Rejoindre la room socket
    socket.join(`table:${tableId}`);

    // Envoyer l'état du jeu au joueur
    socket.emit('table:joined', {
      tableId,
      gameState: table.getState(userId),
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
  } catch (error) {
    console.error('Error joining table:', error);
    socket.emit('table:error', { message: 'Erreur lors de la connexion', code: 'JOIN_ERROR' });
  }
}

async function handleLeaveTable(
  io: Server,
  socket: AuthenticatedSocket,
  data: { tableId: string }
): Promise<void> {
  const { tableId } = data;
  const userId = socket.userId!;

  try {
    const table = activeTables.get(tableId);
    if (!table) return;

    // Trouver le joueur et son siège
    const state = table.getState(userId);
    const playerInfo = state.players.find((p) => p.odId === userId);
    if (!playerInfo) return;

    // Retirer le joueur de la table
    const player = table.removePlayer(playerInfo.seatNumber);
    if (!player) return;

    // Rendre les jetons au portefeuille
    await prisma.wallet.update({
      where: { userId },
      data: {
        balance: { increment: player.chipStack },
        frozenBalance: { decrement: player.chipStack },
      },
    });

    // Supprimer la relation joueur-table
    playerTables.delete(userId);

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
  }
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

function handleDisconnect(io: Server, socket: AuthenticatedSocket): void {
  const userId = socket.userId;
  if (!userId) return;

  const tableId = playerTables.get(userId);
  if (tableId) {
    // Le joueur est marqué comme "sitting out" au lieu d'être retiré immédiatement
    // Cela permet une reconnexion
    console.log(`Player ${socket.username} disconnected from table ${tableId}`);
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

export { activeTables, playerTables };
