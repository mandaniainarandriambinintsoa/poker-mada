import { Pot as PotType } from '../shared/types/game';
import { HandEvaluator } from './HandEvaluator';
import { Card } from './Card';

interface PlayerBet {
  odId: string;
  amount: number;
  isAllIn: boolean;
}

export class PotManager {
  private mainPot: number = 0;
  private sidePots: PotType[] = [];
  private playerBets: Map<string, PlayerBet> = new Map();
  private roundBets: Map<string, number> = new Map();

  addBet(playerId: string, amount: number, isAllIn: boolean = false): void {
    const currentBet = this.playerBets.get(playerId);

    if (currentBet) {
      currentBet.amount += amount;
      currentBet.isAllIn = currentBet.isAllIn || isAllIn;
    } else {
      this.playerBets.set(playerId, { odId: playerId, amount, isAllIn });
    }

    // Ajouter au bet du round courant
    const roundBet = this.roundBets.get(playerId) || 0;
    this.roundBets.set(playerId, roundBet + amount);
  }

  getCurrentBet(playerId: string): number {
    return this.roundBets.get(playerId) || 0;
  }

  getHighestBet(): number {
    let max = 0;
    for (const amount of this.roundBets.values()) {
      if (amount > max) max = amount;
    }
    return max;
  }

  collectBets(): void {
    // Collecter tous les bets du round dans le pot principal
    for (const amount of this.roundBets.values()) {
      this.mainPot += amount;
    }
    this.roundBets.clear();
  }

  calculateSidePots(activePlayers: string[]): void {
    // Folded players still contribute to every layer they funded.
    const bets = Array.from(this.playerBets.entries());
    const levels = [...new Set(bets.map(([, bet]) => bet.amount))].sort((a, b) => a - b);
    this.sidePots = [];
    let processedAmount = 0;
    for (const level of levels) {
      const contributors = bets.filter(([, bet]) => bet.amount >= level);
      const eligiblePlayers = activePlayers.filter((id) =>
        contributors.some(([contributor]) => contributor === id),
      );
      const amount = (level - processedAmount) * contributors.length;
      if (amount > 0) this.sidePots.push({ amount, eligiblePlayers });
      processedAmount = level;
    }
  }

  distributePot(
    playerHands: Map<string, { holeCards: Card[]; communityCards: Card[] }>,
  ): Map<string, number> {
    const winnings = new Map<string, number>();

    // Calculer les side pots si nécessaire
    const activePlayers = Array.from(playerHands.keys());
    if (this.sidePots.length === 0) {
      this.calculateSidePots(activePlayers);
    }

    // Évaluer les mains des joueurs
    const evaluatedHands = new Map<string, ReturnType<typeof HandEvaluator.evaluate>>();
    for (const [playerId, { holeCards, communityCards }] of playerHands) {
      const evaluated = HandEvaluator.evaluate(holeCards, communityCards);
      evaluatedHands.set(playerId, evaluated);
    }

    // Distribuer chaque pot (side pots d'abord, puis main pot)
    const allPots =
      this.sidePots.length > 0
        ? this.sidePots
        : [{ amount: this.mainPot, eligiblePlayers: activePlayers }];

    for (const pot of allPots) {
      // Trouver le(s) gagnant(s) éligible(s)
      const eligibleHands = Array.from(evaluatedHands.entries()).filter(([playerId]) =>
        pot.eligiblePlayers.includes(playerId),
      );

      if (eligibleHands.length === 0) {
        throw new Error('A funded pot has no eligible player');
      }

      // Trouver la meilleure main
      let bestHand = eligibleHands[0][1];
      const potWinners: string[] = [eligibleHands[0][0]];

      for (let i = 1; i < eligibleHands.length; i++) {
        const [playerId, hand] = eligibleHands[i];
        const comparison = HandEvaluator.compareHands(hand, bestHand);

        if (comparison > 0) {
          bestHand = hand;
          potWinners.length = 0;
          potWinners.push(playerId);
        } else if (comparison === 0) {
          potWinners.push(playerId); // Split pot
        }
      }

      // Distribuer le pot
      const shareAmount = Math.floor(pot.amount / potWinners.length);
      const remainder = pot.amount % potWinners.length;
      for (const [index, winnerId] of potWinners.entries()) {
        const current = winnings.get(winnerId) || 0;
        winnings.set(winnerId, current + shareAmount + (index < remainder ? 1 : 0));
      }
    }

    return winnings;
  }

  getTotal(): number {
    return this.mainPot + Array.from(this.roundBets.values()).reduce((a, b) => a + b, 0);
  }

  getMainPot(): number {
    return this.mainPot;
  }

  getSidePots(): PotType[] {
    return this.sidePots.slice(1);
  }

  reset(): void {
    this.mainPot = 0;
    this.sidePots = [];
    this.playerBets.clear();
    this.roundBets.clear();
  }

  newRound(): void {
    this.collectBets();
  }

  getState(): { mainPot: number; sidePots: PotType[] } {
    return {
      mainPot: this.getTotal(),
      sidePots: this.sidePots.slice(1), // Exclure le main pot s'il est dans sidePots
    };
  }
}
