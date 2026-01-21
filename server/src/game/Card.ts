import { Card as CardType, Suit, Rank } from '../../../shared/types/game';

export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: 'h',
  diamonds: 'd',
  clubs: 'c',
  spades: 's',
};

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

export class Card implements CardType {
  suit: Suit;
  rank: Rank;
  code: string;

  constructor(suit: Suit, rank: Rank) {
    this.suit = suit;
    this.rank = rank;
    this.code = `${rank}${SUIT_SYMBOLS[suit]}`;
  }

  getValue(): number {
    return RANK_VALUES[this.rank];
  }

  toString(): string {
    return this.code;
  }

  equals(other: Card): boolean {
    return this.suit === other.suit && this.rank === other.rank;
  }

  static fromCode(code: string): Card {
    const suitChar = code.slice(-1);
    const rankStr = code.slice(0, -1) as Rank;

    const suitMap: Record<string, Suit> = {
      h: 'hearts',
      d: 'diamonds',
      c: 'clubs',
      s: 'spades',
    };

    const suit = suitMap[suitChar];
    if (!suit || !RANKS.includes(rankStr)) {
      throw new Error(`Code de carte invalide: ${code}`);
    }

    return new Card(suit, rankStr);
  }

  toJSON(): CardType {
    return {
      suit: this.suit,
      rank: this.rank,
      code: this.code,
    };
  }
}
