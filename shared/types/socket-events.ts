import { Card, GameState, PlayerAction, TableConfigDTO, TablePlayer, GamePhase } from './game';

// ============================================
// ÉVÉNEMENTS CLIENT -> SERVEUR
// ============================================

export interface ClientToServerEvents {
  // Lobby
  'lobby:join': () => void;
  'lobby:leave': () => void;
  'lobby:get-tables': () => void;

  // Table
  'table:join': (data: { tableId: string; buyIn: number }) => void;
  'table:leave': (data: { tableId: string }) => void;
  'table:sit': (data: { tableId: string; seatNumber: number }) => void;
  'table:stand': (data: { tableId: string }) => void;
  'table:sit-out': (data: { tableId: string }) => void;
  'table:sit-in': (data: { tableId: string }) => void;
  'table:add-chips': (data: { tableId: string; amount: number }) => void;

  // Actions de jeu
  'game:action': (data: { tableId: string; action: PlayerAction; amount?: number }) => void;

  // Chat
  'chat:send': (data: { tableId: string; message: string }) => void;

  // Ping/Pong pour heartbeat
  ping: () => void;
}

// ============================================
// ÉVÉNEMENTS SERVEUR -> CLIENT
// ============================================

export interface ServerToClientEvents {
  // Lobby
  'lobby:tables-update': (tables: TableConfigDTO[]) => void;
  'lobby:player-count': (count: number) => void;

  // Table
  'table:joined': (data: { tableId: string; gameState: GameState }) => void;
  'table:left': (data: { tableId: string }) => void;
  'table:player-joined': (data: { player: TablePlayer }) => void;
  'table:player-left': (data: { odId: string; seatNumber: number }) => void;
  'table:error': (data: { message: string; code: string }) => void;

  // Mises à jour du jeu
  'game:state-update': (gameState: GameState) => void;
  'game:your-turn': (data: {
    availableActions: PlayerAction[];
    minRaise: number;
    maxRaise: number;
    timeRemaining: number;
  }) => void;
  'game:action-made': (data: {
    odId: string
    action: PlayerAction;
    amount?: number;
  }) => void;
  'game:new-hand': (data: { handNumber: number; dealerPosition: number }) => void;
  'game:deal-hole-cards': (cards: Card[]) => void;
  'game:deal-community': (data: { phase: GamePhase; cards: Card[] }) => void;
  'game:showdown': (data: {
    players: { odId: string; holeCards: Card[]; hand: string }[];
    winners: { odId: string; amount: number; hand: string }[];
  }) => void;
  'game:hand-complete': (data: { winners: { odId: string; amount: number }[] }) => void;
  'game:timer-update': (data: { odId: string; timeRemaining: number }) => void;

  // Chat
  'chat:message': (data: {
    odId: string
    username: string;
    message: string;
    timestamp: number;
  }) => void;
  'chat:system': (data: { message: string; type: 'info' | 'warning' | 'error' }) => void;

  // Connexion
  pong: () => void;
  error: (data: { message: string; code: string }) => void;
  'reconnect-required': () => void;
}
