import { Card, RANK_VALUES } from './Card';
import { HandRank, EvaluatedHand } from '../shared/types/game';

interface CardGroup {
  rank: string;
  count: number;
  value: number;
}

export class HandEvaluator {
  private static readonly HAND_RANK_VALUES: Record<HandRank, number> = {
    'high-card': 1,
    pair: 2,
    'two-pair': 3,
    'three-of-a-kind': 4,
    straight: 5,
    flush: 6,
    'full-house': 7,
    'four-of-a-kind': 8,
    'straight-flush': 9,
    'royal-flush': 10,
  };

  static evaluate(holeCards: Card[], communityCards: Card[]): EvaluatedHand {
    const allCards = [...holeCards, ...communityCards];

    if (allCards.length < 5) {
      throw new Error('Il faut au moins 5 cartes pour évaluer une main');
    }

    // Générer toutes les combinaisons de 5 cartes
    const combinations = this.getCombinations(allCards, 5);

    let bestHand: EvaluatedHand | null = null;

    for (const combo of combinations) {
      const evaluated = this.evaluateFiveCards(combo);
      if (!bestHand || this.compareHands(evaluated, bestHand) > 0) {
        bestHand = evaluated;
      }
    }

    return bestHand!;
  }

  private static getCombinations(cards: Card[], size: number): Card[][] {
    const result: Card[][] = [];

    function combine(start: number, current: Card[]): void {
      if (current.length === size) {
        result.push([...current]);
        return;
      }

      for (let i = start; i < cards.length; i++) {
        current.push(cards[i]);
        combine(i + 1, current);
        current.pop();
      }
    }

    combine(0, []);
    return result;
  }

  private static evaluateFiveCards(cards: Card[]): EvaluatedHand {
    const sorted = this.sortByRank(cards);
    const isFlush = this.isFlush(cards);
    const isStraight = this.isStraight(sorted);
    const groups = this.getGroups(cards);

    // Royal Flush
    if (isFlush && isStraight && sorted[0].getValue() === 14) {
      return {
        rank: 'royal-flush',
        rankValue: 10,
        cards: sorted,
        description: 'Quinte Flush Royale',
      };
    }

    // Straight Flush
    if (isFlush && isStraight) {
      return {
        rank: 'straight-flush',
        rankValue: 9,
        cards: sorted,
        description: `Quinte Flush au ${this.getRankName(sorted[0].rank)}`,
      };
    }

    // Four of a Kind
    if (groups[0].count === 4) {
      return {
        rank: 'four-of-a-kind',
        rankValue: 8,
        cards: sorted,
        description: `Carré de ${this.getRankName(groups[0].rank)}`,
      };
    }

    // Full House
    if (groups[0].count === 3 && groups[1]?.count === 2) {
      return {
        rank: 'full-house',
        rankValue: 7,
        cards: sorted,
        description: `Full aux ${this.getRankName(groups[0].rank)} par les ${this.getRankName(groups[1].rank)}`,
      };
    }

    // Flush
    if (isFlush) {
      return {
        rank: 'flush',
        rankValue: 6,
        cards: sorted,
        description: `Couleur au ${this.getRankName(sorted[0].rank)}`,
      };
    }

    // Straight
    if (isStraight) {
      return {
        rank: 'straight',
        rankValue: 5,
        cards: sorted,
        description: `Quinte au ${this.getRankName(sorted[0].rank)}`,
      };
    }

    // Three of a Kind
    if (groups[0].count === 3) {
      return {
        rank: 'three-of-a-kind',
        rankValue: 4,
        cards: sorted,
        description: `Brelan de ${this.getRankName(groups[0].rank)}`,
      };
    }

    // Two Pair
    if (groups[0].count === 2 && groups[1]?.count === 2) {
      return {
        rank: 'two-pair',
        rankValue: 3,
        cards: sorted,
        description: `Double paire ${this.getRankName(groups[0].rank)} et ${this.getRankName(groups[1].rank)}`,
      };
    }

    // Pair
    if (groups[0].count === 2) {
      return {
        rank: 'pair',
        rankValue: 2,
        cards: sorted,
        description: `Paire de ${this.getRankName(groups[0].rank)}`,
      };
    }

    // High Card
    return {
      rank: 'high-card',
      rankValue: 1,
      cards: sorted,
      description: `Hauteur ${this.getRankName(sorted[0].rank)}`,
    };
  }

  static compareHands(hand1: EvaluatedHand, hand2: EvaluatedHand): number {
    // Comparer le rang de la main
    if (hand1.rankValue !== hand2.rankValue) {
      return hand1.rankValue - hand2.rankValue;
    }

    // Même rang: comparer les kickers
    for (let i = 0; i < Math.min(hand1.cards.length, hand2.cards.length); i++) {
      const val1 = RANK_VALUES[hand1.cards[i].rank as keyof typeof RANK_VALUES];
      const val2 = RANK_VALUES[hand2.cards[i].rank as keyof typeof RANK_VALUES];
      const diff = val1 - val2;
      if (diff !== 0) return diff;
    }

    return 0; // Égalité parfaite
  }

  private static sortByRank(cards: Card[]): Card[] {
    return [...cards].sort((a, b) => {
      const valA = RANK_VALUES[a.rank as keyof typeof RANK_VALUES];
      const valB = RANK_VALUES[b.rank as keyof typeof RANK_VALUES];
      return valB - valA;
    });
  }

  private static isFlush(cards: Card[]): boolean {
    const suit = cards[0].suit;
    return cards.every((card) => card.suit === suit);
  }

  private static isStraight(sortedCards: Card[]): boolean {
    const values = sortedCards.map((c) => c.getValue());

    // Cas spécial: A-2-3-4-5 (roue)
    if (values[0] === 14 && values[1] === 5 && values[2] === 4 && values[3] === 3 && values[4] === 2) {
      return true;
    }

    // Vérifier si les cartes sont consécutives
    for (let i = 0; i < values.length - 1; i++) {
      if (values[i] - values[i + 1] !== 1) {
        return false;
      }
    }

    return true;
  }

  private static getGroups(cards: Card[]): CardGroup[] {
    const groups: Map<string, CardGroup> = new Map();

    for (const card of cards) {
      const existing = groups.get(card.rank);
      if (existing) {
        existing.count++;
      } else {
        groups.set(card.rank, {
          rank: card.rank,
          count: 1,
          value: card.getValue(),
        });
      }
    }

    // Trier par count (desc) puis par value (desc)
    return Array.from(groups.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.value - a.value;
    });
  }

  private static getRankName(rank: string): string {
    const names: Record<string, string> = {
      '2': 'Deux',
      '3': 'Trois',
      '4': 'Quatre',
      '5': 'Cinq',
      '6': 'Six',
      '7': 'Sept',
      '8': 'Huit',
      '9': 'Neuf',
      '10': 'Dix',
      J: 'Valet',
      Q: 'Dame',
      K: 'Roi',
      A: 'As',
    };
    return names[rank] || rank;
  }

  static getHandRankValue(rank: HandRank): number {
    return this.HAND_RANK_VALUES[rank];
  }
}
