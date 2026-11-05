import Dexie, { type EntityTable } from 'dexie'
import type { Card, Deck, ReviewLog, Settings } from './types'

export class LingoDatabase extends Dexie {
  decks!: EntityTable<Deck, 'id'>
  cards!: EntityTable<Card, 'id'>
  reviewLogs!: EntityTable<ReviewLog, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('lingo-cards')
    this.version(1).stores({
      decks: 'id, name, createdAt',
      cards: 'id, deckId, state, due, [deckId+state], [deckId+due], *tags, front, createdAt, updatedAt',
      reviewLogs: 'id, cardId, deckId, reviewedAt',
      settings: 'id',
    })
  }
}

export const db = new LingoDatabase()
