import type { CardDefinition, CardSetDefinition } from './card-schema';
import { assertCardDefinition, assertCardSet } from './card-schema';

export class CardRegistry {
  private cards = new Map<string, CardDefinition>();

  registerCard(card: CardDefinition): void {
    assertCardDefinition(card);
    if (this.cards.has(card.id)) {
      throw new Error(`Карта с id "${card.id}" уже зарегистрирована.`);
    }
    this.cards.set(card.id, card);
  }

  registerCards(cards: CardDefinition[]): void {
    for (const card of cards) {
      this.registerCard(card);
    }
  }

  registerCardSet(cardSet: CardSetDefinition): void {
    assertCardSet(cardSet);
    this.registerCards(cardSet.cards);
  }

  getCard(cardId: string): CardDefinition | undefined {
    return this.cards.get(cardId);
  }

  getAllCards(): CardDefinition[] {
    return [...this.cards.values()];
  }
}
