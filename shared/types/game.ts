// Types des cartes
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
  code: string; // Ex: "Ah" pour As de coeur
}

// Phases de jeu
export type GamePhase = 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

// Actions possibles
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all-in';

export interface ActionRequest {
  action: PlayerAction;
  amount?: number;
}

// Joueur à la table
export interface TablePlayer {
  odId: string
  username: string;
  avatar?: string;
  seatNumber: number;
  chipStack: number;
  currentBet: number;
  isActive: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  isSittingOut: boolean;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  holeCards?: Card[];
  hasActed: boolean;
  lastAction?: PlayerAction;
  timeBank: number;
}

// Pot (principal et side pots)
export interface Pot {
  amount: number;
  eligiblePlayers: string[];
}

// État complet du jeu
export interface GameState {
  sessionId: string;
  tableId: string;
  tableName: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  phase: GamePhase;
  handNumber: number;
  players: TablePlayer[];
  maxPlayers: number;
  dealerPosition: number;
  currentPlayerIndex: number;
  currentPlayerId?: string;
  communityCards: Card[];
  mainPot: number;
  sidePots: Pot[];
  currentBet: number;
  minRaise: number;
  turnStartTime: number;
  turnTimeout: number;
  availableActions: PlayerAction[];
  winners?: {
    odId: string
    amount: number;
    hand: string;
  }[];
}

// Configuration de table
export interface TableConfigDTO {
  id: string;
  name: string;
  tier: 'SMALL' | 'MEDIUM' | 'HIGH';
  minBuyIn: number;
  maxBuyIn: number;
  smallBlind: number;
  bigBlind: number;
  maxPlayers: number;
  currentPlayers: number;
  isActive: boolean;
}

// Classement des mains
export type HandRank =
  | 'high-card'
  | 'pair'
  | 'two-pair'
  | 'three-of-a-kind'
  | 'straight'
  | 'flush'
  | 'full-house'
  | 'four-of-a-kind'
  | 'straight-flush'
  | 'royal-flush';

export interface EvaluatedHand {
  rank: HandRank;
  rankValue: number;
  cards: Card[];
  description: string;
}
