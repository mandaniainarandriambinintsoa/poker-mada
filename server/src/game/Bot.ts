/**
 * BOT POKER - POUR TESTS UNIQUEMENT
 *
 * Ce système de bot est temporaire et destiné aux tests de l'application.
 * Il sera retiré en production quand il y aura assez de vrais joueurs.
 *
 * TODO: Retirer ce fichier et les références au bot avant la mise en production
 */

import { PokerTable } from './Table';
import { PlayerAction, GameState } from '../shared/types/game';
import { HandEvaluator } from './HandEvaluator';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

interface BotConfig {
  odId: string;
  username: string;
  difficulty: BotDifficulty;
  chipStack: number;
}

const BOT_NAMES = [
  'PokerBot_1', 'Lucky_Bot', 'CardMaster', 'BluffKing',
  'ChipHunter', 'AceBot', 'RoyalFlush', 'PokerPro'
];

let botCounter = 0;

export function generateBotId(): string {
  return `bot-${Date.now()}-${++botCounter}`;
}

export function generateBotName(): string {
  return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + '_' + Math.floor(Math.random() * 100);
}

export function getBotDifficultyForTable(tableId: string): BotDifficulty {
  if (tableId.includes('small')) return 'easy';
  if (tableId.includes('medium')) return 'medium';
  if (tableId.includes('high')) return 'hard';
  return 'medium';
}

export class PokerBot {
  private odId: string;
  private username: string;
  private difficulty: BotDifficulty;
  private thinkingTime: { min: number; max: number };

  constructor(config: BotConfig) {
    this.odId = config.odId;
    this.username = config.username;
    this.difficulty = config.difficulty;

    // Temps de réflexion selon la difficulté (en ms)
    switch (this.difficulty) {
      case 'easy':
        this.thinkingTime = { min: 1000, max: 2000 };
        break;
      case 'medium':
        this.thinkingTime = { min: 1500, max: 3000 };
        break;
      case 'hard':
        this.thinkingTime = { min: 2000, max: 4000 };
        break;
    }
  }

  getId(): string {
    return this.odId;
  }

  getUsername(): string {
    return this.username;
  }

  /**
   * Décide de l'action à effectuer basée sur l'état du jeu
   */
  decideAction(
    gameState: GameState,
    availableActions: PlayerAction[]
  ): { action: PlayerAction; amount?: number } {
    const myPlayer = gameState.players.find(p => p.odId === this.odId);
    if (!myPlayer) {
      return { action: 'fold' };
    }

    // Calculer la force de la main (simplifié)
    const handStrength = this.evaluateHandStrength(gameState);

    switch (this.difficulty) {
      case 'easy':
        return this.easyStrategy(gameState, availableActions, handStrength, myPlayer.chipStack);
      case 'medium':
        return this.mediumStrategy(gameState, availableActions, handStrength, myPlayer.chipStack);
      case 'hard':
        return this.hardStrategy(gameState, availableActions, handStrength, myPlayer.chipStack);
      default:
        return { action: 'fold' };
    }
  }

  /**
   * Stratégie facile - Joue de manière prévisible
   */
  private easyStrategy(
    gameState: GameState,
    availableActions: PlayerAction[],
    handStrength: number,
    chipStack: number
  ): { action: PlayerAction; amount?: number } {
    const toCall = gameState.currentBet - (gameState.players.find(p => p.odId === this.odId)?.currentBet || 0);

    // Bot facile: suit souvent, relance rarement
    if (handStrength > 0.7) {
      // Bonne main - relance parfois
      if (availableActions.includes('raise') && Math.random() > 0.5) {
        const raiseAmount = gameState.bigBlind * 2;
        return { action: 'raise', amount: Math.min(raiseAmount + toCall, chipStack) };
      }
      return availableActions.includes('call') ? { action: 'call' } : { action: 'check' };
    }

    if (handStrength > 0.4) {
      // Main moyenne - suit
      if (toCall === 0 && availableActions.includes('check')) {
        return { action: 'check' };
      }
      if (toCall < chipStack * 0.2 && availableActions.includes('call')) {
        return { action: 'call' };
      }
    }

    // Main faible - fold sauf si on peut checker
    if (availableActions.includes('check')) {
      return { action: 'check' };
    }
    return { action: 'fold' };
  }

  /**
   * Stratégie moyenne - Plus équilibrée
   */
  private mediumStrategy(
    gameState: GameState,
    availableActions: PlayerAction[],
    handStrength: number,
    chipStack: number
  ): { action: PlayerAction; amount?: number } {
    const myPlayer = gameState.players.find(p => p.odId === this.odId)!;
    const toCall = gameState.currentBet - myPlayer.currentBet;
    const potOdds = toCall / (gameState.mainPot + toCall);

    // Ajouter du bluff occasionnel
    const isBluffing = Math.random() < 0.15;

    if (handStrength > 0.8 || isBluffing) {
      // Très bonne main ou bluff - relance
      if (availableActions.includes('raise')) {
        const raiseAmount = gameState.bigBlind * (2 + Math.floor(Math.random() * 3));
        return { action: 'raise', amount: Math.min(raiseAmount + toCall, chipStack) };
      }
    }

    if (handStrength > 0.5 || (handStrength > potOdds)) {
      // Main correcte ou bonnes cotes
      if (toCall === 0 && availableActions.includes('check')) {
        return { action: 'check' };
      }
      if (availableActions.includes('call')) {
        return { action: 'call' };
      }
    }

    if (availableActions.includes('check')) {
      return { action: 'check' };
    }
    return { action: 'fold' };
  }

  /**
   * Stratégie difficile - Joue de manière plus sophistiquée
   */
  private hardStrategy(
    gameState: GameState,
    availableActions: PlayerAction[],
    handStrength: number,
    chipStack: number
  ): { action: PlayerAction; amount?: number } {
    const myPlayer = gameState.players.find(p => p.odId === this.odId)!;
    const toCall = gameState.currentBet - myPlayer.currentBet;
    const potOdds = toCall / (gameState.mainPot + toCall);
    const position = this.getPosition(gameState);

    // Facteurs de décision avancés
    const isBluffing = Math.random() < 0.2;
    const aggression = position === 'late' ? 1.3 : 1.0;
    const effectiveStrength = handStrength * aggression;

    // Très forte main ou semi-bluff
    if (effectiveStrength > 0.85 || (isBluffing && position === 'late')) {
      if (availableActions.includes('raise')) {
        // Calcul du montant de relance basé sur le pot
        const potSizeRaise = gameState.mainPot * (0.5 + Math.random() * 0.5);
        const raiseAmount = Math.max(gameState.minRaise, potSizeRaise);
        return { action: 'raise', amount: Math.min(raiseAmount + toCall, chipStack) };
      }
    }

    // Bonne main
    if (effectiveStrength > 0.6) {
      if (toCall === 0) {
        // Position de force - relance légère
        if (availableActions.includes('raise') && Math.random() > 0.4) {
          return { action: 'raise', amount: Math.min(gameState.bigBlind * 3, chipStack) };
        }
        return { action: 'check' };
      }
      return availableActions.includes('call') ? { action: 'call' } : { action: 'check' };
    }

    // Main marginale - utilise les cotes du pot
    if (effectiveStrength > potOdds && toCall < chipStack * 0.15) {
      return availableActions.includes('call') ? { action: 'call' } : { action: 'check' };
    }

    // Check ou fold
    if (availableActions.includes('check')) {
      return { action: 'check' };
    }
    return { action: 'fold' };
  }

  /**
   * Évalue la force de la main (0-1)
   */
  private evaluateHandStrength(gameState: GameState): number {
    const myPlayer = gameState.players.find(p => p.odId === this.odId);

    // Si on ne peut pas voir ses cartes, retourner une force aléatoire
    // pour éviter de toujours fold
    if (!myPlayer || !myPlayer.holeCards || myPlayer.holeCards.length < 2) {
      // Générer une force aléatoire entre 0.3 et 0.7
      return 0.3 + Math.random() * 0.4;
    }

    const holeCards = myPlayer.holeCards;
    const communityCards = gameState.communityCards;

    // Préflop - évaluation basée sur les cartes privées
    if (communityCards.length === 0) {
      return this.evaluatePreflopStrength(holeCards);
    }

    // Postflop - évaluation simplifiée
    return this.evaluatePostflopStrength(holeCards, communityCards);
  }

  private evaluatePreflopStrength(holeCards: any[]): number {
    const ranks = holeCards.map(c => this.rankToValue(c.rank));
    const suited = holeCards[0].suit === holeCards[1].suit;
    const paired = ranks[0] === ranks[1];
    const highCard = Math.max(...ranks);
    const connected = Math.abs(ranks[0] - ranks[1]) === 1;

    let strength = 0.2;

    // Paire
    if (paired) {
      strength = 0.5 + (highCard / 14) * 0.4; // AA = 0.9, 22 = 0.5
    } else {
      // Cartes hautes
      strength = (highCard / 14) * 0.4 + (Math.min(...ranks) / 14) * 0.2;

      // Bonus suited
      if (suited) strength += 0.1;

      // Bonus connectées
      if (connected) strength += 0.05;
    }

    return Math.min(strength, 1);
  }

  private evaluatePostflopStrength(holeCards: any[], communityCards: any[]): number {
    // Évaluation simplifiée postflop
    // Vérifie les paires, deux paires, brelans, etc.
    const allRanks = [...holeCards, ...communityCards].map(c => this.rankToValue(c.rank));
    const rankCounts = new Map<number, number>();

    for (const rank of allRanks) {
      rankCounts.set(rank, (rankCounts.get(rank) || 0) + 1);
    }

    const counts = Array.from(rankCounts.values()).sort((a, b) => b - a);

    // Carré
    if (counts[0] === 4) return 0.95;

    // Full
    if (counts[0] === 3 && counts[1] === 2) return 0.9;

    // Brelan
    if (counts[0] === 3) return 0.75;

    // Deux paires
    if (counts[0] === 2 && counts[1] === 2) return 0.6;

    // Paire
    if (counts[0] === 2) return 0.45;

    // Carte haute
    return 0.25;
  }

  private rankToValue(rank: string): number {
    const values: Record<string, number> = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
      '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return values[rank] || 2;
  }

  private getPosition(gameState: GameState): 'early' | 'middle' | 'late' {
    const myPlayer = gameState.players.find(p => p.odId === this.odId);
    if (!myPlayer) return 'middle';

    const activePlayers = gameState.players.filter(p => p.isActive && !p.isFolded);
    const myIndex = activePlayers.findIndex(p => p.odId === this.odId);
    const totalActive = activePlayers.length;

    if (myIndex < totalActive / 3) return 'early';
    if (myIndex < (totalActive * 2) / 3) return 'middle';
    return 'late';
  }

  /**
   * Retourne le temps de réflexion simulé
   */
  getThinkingTime(): number {
    return this.thinkingTime.min + Math.random() * (this.thinkingTime.max - this.thinkingTime.min);
  }
}
