import { Card, SUITS, RANKS } from './Card';

export class Deck {
  private cards: Card[] = [];
  private dealtCards: Card[] = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    this.cards = [];
    this.dealtCards = [];

    // Créer les 52 cartes
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push(new Card(suit, rank));
      }
    }
  }

  shuffle(): void {
    // Algorithme de Fisher-Yates
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal(count: number = 1): Card[] {
    if (count > this.cards.length) {
      throw new Error('Pas assez de cartes dans le paquet');
    }

    const dealt: Card[] = [];
    for (let i = 0; i < count; i++) {
      const card = this.cards.pop()!;
      dealt.push(card);
      this.dealtCards.push(card);
    }

    return dealt;
  }

  dealOne(): Card {
    return this.deal(1)[0];
  }

  burn(): Card {
    // Brûler une carte (la mettre de côté sans la montrer)
    return this.dealOne();
  }

  remaining(): number {
    return this.cards.length;
  }

  getDealtCards(): Card[] {
    return [...this.dealtCards];
  }
}
