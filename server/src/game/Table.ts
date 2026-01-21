import { GameState, GamePhase, PlayerAction, TablePlayer, Card as CardType } from '../../../shared/types/game';
import { Card } from './Card';
import { Deck } from './Deck';
import { PotManager } from './Pot';
import { HandEvaluator } from './HandEvaluator';

interface TableConfig {
  id: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  maxPlayers: number;
  turnTimeout: number;
}

interface Player {
  odId: string
  username: string;
  avatar?: string;
  seatNumber: number;
  chipStack: number;
  currentBet: number;
  holeCards: Card[];
  isActive: boolean;
  isFolded: boolean;
  isAllIn: boolean;
  isSittingOut: boolean;
  hasActed: boolean;
  lastAction?: PlayerAction;
}

export class PokerTable {
  private config: TableConfig;
  private players: Map<number, Player> = new Map();
  private deck: Deck;
  private pot: PotManager;

  private phase: GamePhase = 'waiting';
  private handNumber: number = 0;
  private communityCards: Card[] = [];
  private dealerPosition: number = -1;
  private currentPlayerIndex: number = -1;
  private currentBet: number = 0;
  private minRaise: number = 0;
  private turnStartTime: number = 0;
  private lastRaiser: string | null = null;

  constructor(config: TableConfig) {
    this.config = config;
    this.deck = new Deck();
    this.pot = new PotManager();
  }

  // Gestion des joueurs
  addPlayer(
    userId: string,
    username: string,
    seatNumber: number,
    buyIn: number,
    avatar?: string
  ): boolean {
    if (this.players.has(seatNumber)) {
      return false; // Siège occupé
    }

    if (buyIn < this.config.minBuyIn || buyIn > this.config.maxBuyIn) {
      return false; // Buy-in invalide
    }

    this.players.set(seatNumber, {
      odId: userId,
      username,
      avatar,
      seatNumber,
      chipStack: buyIn,
      currentBet: 0,
      holeCards: [],
      isActive: true,
      isFolded: false,
      isAllIn: false,
      isSittingOut: false,
      hasActed: false,
    });

    // Démarrer une nouvelle main si assez de joueurs
    if (this.phase === 'waiting' && this.getActivePlayerCount() >= 2) {
      this.startNewHand();
    }

    return true;
  }

  removePlayer(seatNumber: number): Player | null {
    const player = this.players.get(seatNumber);
    if (!player) return null;

    this.players.delete(seatNumber);

    // Arrêter la partie si pas assez de joueurs
    if (this.getActivePlayerCount() < 2 && this.phase !== 'waiting') {
      this.phase = 'waiting';
    }

    return player;
  }

  // Démarrage d'une nouvelle main
  startNewHand(): void {
    this.handNumber++;
    this.phase = 'preflop';
    this.communityCards = [];
    this.pot.reset();
    this.currentBet = 0;
    this.lastRaiser = null;

    // Réinitialiser les joueurs
    for (const player of this.players.values()) {
      player.currentBet = 0;
      player.holeCards = [];
      player.isFolded = false;
      player.isAllIn = false;
      player.hasActed = false;
      player.lastAction = undefined;
      player.isActive = !player.isSittingOut && player.chipStack > 0;
    }

    // Déplacer le bouton dealer
    this.moveDealer();

    // Mélanger et distribuer
    this.deck.reset();
    this.deck.shuffle();
    this.dealHoleCards();

    // Poster les blinds
    this.postBlinds();

    // Démarrer le premier tour
    this.startTurn();
  }

  private moveDealer(): void {
    const seats = this.getActiveSeatNumbers();
    if (seats.length === 0) return;

    if (this.dealerPosition === -1) {
      this.dealerPosition = seats[0];
    } else {
      const currentIndex = seats.indexOf(this.dealerPosition);
      this.dealerPosition = seats[(currentIndex + 1) % seats.length];
    }
  }

  private dealHoleCards(): void {
    const seats = this.getActiveSeatNumbers();

    // Distribuer 2 cartes à chaque joueur
    for (let round = 0; round < 2; round++) {
      for (const seat of seats) {
        const player = this.players.get(seat)!;
        if (player.isActive) {
          player.holeCards.push(this.deck.dealOne());
        }
      }
    }
  }

  private postBlinds(): void {
    const seats = this.getActiveSeatNumbers();
    const dealerIndex = seats.indexOf(this.dealerPosition);

    // Small blind
    const sbIndex = (dealerIndex + 1) % seats.length;
    const sbPlayer = this.players.get(seats[sbIndex])!;
    this.placeBet(sbPlayer, Math.min(this.config.smallBlind, sbPlayer.chipStack));

    // Big blind
    const bbIndex = (dealerIndex + 2) % seats.length;
    const bbPlayer = this.players.get(seats[bbIndex])!;
    this.placeBet(bbPlayer, Math.min(this.config.bigBlind, bbPlayer.chipStack));

    this.currentBet = this.config.bigBlind;
    this.minRaise = this.config.bigBlind;
  }

  private placeBet(player: Player, amount: number): void {
    const actualAmount = Math.min(amount, player.chipStack);
    player.chipStack -= actualAmount;
    player.currentBet += actualAmount;
    this.pot.addBet(player.odId, actualAmount, player.chipStack === 0);

    if (player.chipStack === 0) {
      player.isAllIn = true;
    }
  }

  // Gestion des tours
  private startTurn(): void {
    const nextPlayer = this.findNextPlayer();
    if (!nextPlayer) {
      this.advancePhase();
      return;
    }

    this.currentPlayerIndex = nextPlayer.seatNumber;
    this.turnStartTime = Date.now();
  }

  private findNextPlayer(): Player | null {
    const seats = this.getActiveSeatNumbers();
    if (seats.length === 0) return null;

    const startIndex =
      this.currentPlayerIndex === -1 ? 0 : seats.indexOf(this.currentPlayerIndex);

    for (let i = 1; i <= seats.length; i++) {
      const seatNum = seats[(startIndex + i) % seats.length];
      const player = this.players.get(seatNum)!;

      if (player.isActive && !player.isFolded && !player.isAllIn) {
        // Vérifier si le joueur doit encore agir
        if (!player.hasActed || player.currentBet < this.currentBet) {
          return player;
        }
      }
    }

    return null;
  }

  // Actions du joueur
  executeAction(playerId: string, action: PlayerAction, amount?: number): boolean {
    const player = this.findPlayerById(playerId);
    if (!player) return false;

    if (player.seatNumber !== this.currentPlayerIndex) {
      return false; // Ce n'est pas son tour
    }

    switch (action) {
      case 'fold':
        return this.fold(player);
      case 'check':
        return this.check(player);
      case 'call':
        return this.call(player);
      case 'raise':
        return this.raise(player, amount || 0);
      case 'all-in':
        return this.allIn(player);
      default:
        return false;
    }
  }

  private fold(player: Player): boolean {
    player.isFolded = true;
    player.isActive = false;
    player.hasActed = true;
    player.lastAction = 'fold';

    this.checkForWinner();
    return true;
  }

  private check(player: Player): boolean {
    if (player.currentBet < this.currentBet) {
      return false; // Ne peut pas checker s'il y a une mise à suivre
    }

    player.hasActed = true;
    player.lastAction = 'check';
    this.startTurn();
    return true;
  }

  private call(player: Player): boolean {
    const toCall = this.currentBet - player.currentBet;
    if (toCall <= 0) return false;

    this.placeBet(player, toCall);
    player.hasActed = true;
    player.lastAction = 'call';
    this.startTurn();
    return true;
  }

  private raise(player: Player, amount: number): boolean {
    const toCall = this.currentBet - player.currentBet;
    const raiseAmount = amount - toCall;

    if (raiseAmount < this.minRaise && player.chipStack > amount) {
      return false; // Relance insuffisante
    }

    this.placeBet(player, amount);
    this.currentBet = player.currentBet;
    this.minRaise = raiseAmount;
    this.lastRaiser = player.odId;

    // Réinitialiser hasActed pour les autres joueurs
    for (const p of this.players.values()) {
      if (p.odId !== player.odId && !p.isFolded && !p.isAllIn) {
        p.hasActed = false;
      }
    }

    player.hasActed = true;
    player.lastAction = 'raise';
    this.startTurn();
    return true;
  }

  private allIn(player: Player): boolean {
    const amount = player.chipStack;
    this.placeBet(player, amount);

    if (player.currentBet > this.currentBet) {
      this.currentBet = player.currentBet;
      this.lastRaiser = player.odId;

      // Réinitialiser hasActed pour les autres joueurs
      for (const p of this.players.values()) {
        if (p.odId !== player.odId && !p.isFolded && !p.isAllIn) {
          p.hasActed = false;
        }
      }
    }

    player.hasActed = true;
    player.lastAction = 'all-in';
    this.startTurn();
    return true;
  }

  // Phases du jeu
  private advancePhase(): void {
    this.pot.newRound();
    this.currentBet = 0;
    this.lastRaiser = null;

    // Réinitialiser les bets et hasActed des joueurs
    for (const player of this.players.values()) {
      player.currentBet = 0;
      player.hasActed = false;
    }

    switch (this.phase) {
      case 'preflop':
        this.phase = 'flop';
        this.dealFlop();
        break;
      case 'flop':
        this.phase = 'turn';
        this.dealTurn();
        break;
      case 'turn':
        this.phase = 'river';
        this.dealRiver();
        break;
      case 'river':
        this.phase = 'showdown';
        this.showdown();
        return;
    }

    this.currentPlayerIndex = -1;
    this.startTurn();
  }

  private dealFlop(): void {
    this.deck.burn();
    this.communityCards.push(...this.deck.deal(3));
  }

  private dealTurn(): void {
    this.deck.burn();
    this.communityCards.push(this.deck.dealOne());
  }

  private dealRiver(): void {
    this.deck.burn();
    this.communityCards.push(this.deck.dealOne());
  }

  private showdown(): void {
    // Calculer les mains et distribuer le pot
    const activePlayers = Array.from(this.players.values()).filter(
      (p) => !p.isFolded && p.isActive
    );

    const playerHands = new Map<string, { holeCards: Card[]; communityCards: Card[] }>();

    for (const player of activePlayers) {
      playerHands.set(player.odId, {
        holeCards: player.holeCards,
        communityCards: this.communityCards,
      });
    }

    const winnings = this.pot.distributePot(playerHands);

    // Ajouter les gains aux stacks des joueurs
    for (const [playerId, amount] of winnings) {
      const player = this.findPlayerById(playerId);
      if (player) {
        player.chipStack += amount;
      }
    }

    // Après un délai, démarrer une nouvelle main
    setTimeout(() => {
      if (this.getActivePlayerCount() >= 2) {
        this.startNewHand();
      } else {
        this.phase = 'waiting';
      }
    }, 5000);
  }

  private checkForWinner(): void {
    const activePlayers = Array.from(this.players.values()).filter((p) => !p.isFolded);

    if (activePlayers.length === 1) {
      // Un seul joueur reste, il gagne tout
      const winner = activePlayers[0];
      winner.chipStack += this.pot.getTotal();
      this.pot.reset();

      // Démarrer une nouvelle main après un délai
      setTimeout(() => {
        if (this.getActivePlayerCount() >= 2) {
          this.startNewHand();
        } else {
          this.phase = 'waiting';
        }
      }, 3000);
    } else {
      this.startTurn();
    }
  }

  // Utilitaires
  private getActiveSeatNumbers(): number[] {
    const seats: number[] = [];
    for (const [seat, player] of this.players) {
      if (player.isActive && !player.isSittingOut) {
        seats.push(seat);
      }
    }
    return seats.sort((a, b) => a - b);
  }

  private getActivePlayerCount(): number {
    return Array.from(this.players.values()).filter(
      (p) => p.isActive && !p.isSittingOut && p.chipStack > 0
    ).length;
  }

  private findPlayerById(userId: string): Player | null {
    for (const player of this.players.values()) {
      if (player.odId === userId) {
        return player;
      }
    }
    return null;
  }

  getAvailableActions(playerId: string): PlayerAction[] {
    const player = this.findPlayerById(playerId);
    if (!player || player.seatNumber !== this.currentPlayerIndex) {
      return [];
    }

    const actions: PlayerAction[] = ['fold'];

    if (player.currentBet >= this.currentBet) {
      actions.push('check');
    } else {
      actions.push('call');
    }

    if (player.chipStack > this.currentBet - player.currentBet) {
      actions.push('raise');
    }

    actions.push('all-in');

    return actions;
  }

  // État du jeu
  getState(forPlayerId?: string): GameState {
    const players: TablePlayer[] = Array.from(this.players.values()).map((p) => ({
      odId: p.odId,
      username: p.username,
      avatar: p.avatar,
      seatNumber: p.seatNumber,
      chipStack: p.chipStack,
      currentBet: p.currentBet,
      isActive: p.isActive,
      isFolded: p.isFolded,
      isAllIn: p.isAllIn,
      isSittingOut: p.isSittingOut,
      isDealer: p.seatNumber === this.dealerPosition,
      isSmallBlind: this.isSmallBlind(p.seatNumber),
      isBigBlind: this.isBigBlind(p.seatNumber),
      holeCards: p.odId === forPlayerId ? p.holeCards.map((c) => c.toJSON()) : undefined,
      hasActed: p.hasActed,
      lastAction: p.lastAction,
      timeBank: 60,
    }));

    const currentPlayer = this.players.get(this.currentPlayerIndex);

    return {
      sessionId: '', // Sera rempli par le service
      tableId: this.config.id,
      tableName: this.config.name,
      smallBlind: this.config.smallBlind,
      bigBlind: this.config.bigBlind,
      minBuyIn: this.config.minBuyIn,
      maxBuyIn: this.config.maxBuyIn,
      phase: this.phase,
      handNumber: this.handNumber,
      players,
      maxPlayers: this.config.maxPlayers,
      dealerPosition: this.dealerPosition,
      currentPlayerIndex: this.currentPlayerIndex,
      currentPlayerId: currentPlayer?.odId,
      communityCards: this.communityCards.map((c) => c.toJSON()),
      mainPot: this.pot.getTotal(),
      sidePots: this.pot.getSidePots(),
      currentBet: this.currentBet,
      minRaise: this.minRaise,
      turnStartTime: this.turnStartTime,
      turnTimeout: this.config.turnTimeout,
      availableActions: forPlayerId ? this.getAvailableActions(forPlayerId) : [],
    };
  }

  private isSmallBlind(seatNumber: number): boolean {
    const seats = this.getActiveSeatNumbers();
    const dealerIndex = seats.indexOf(this.dealerPosition);
    return seatNumber === seats[(dealerIndex + 1) % seats.length];
  }

  private isBigBlind(seatNumber: number): boolean {
    const seats = this.getActiveSeatNumbers();
    const dealerIndex = seats.indexOf(this.dealerPosition);
    return seatNumber === seats[(dealerIndex + 2) % seats.length];
  }

  getPlayerHoleCards(playerId: string): CardType[] | null {
    const player = this.findPlayerById(playerId);
    return player ? player.holeCards.map((c) => c.toJSON()) : null;
  }
}
