import Dexie, { type EntityTable } from 'dexie'
import type { Card, Deck, ReviewLog, Settings } from './types'

export type OutboxOp = 'upsert' | 'delete' | 'delete_by_card'

export interface OutboxEntry {
  seq?: number
  table: 'decks' | 'cards' | 'review_logs'
  op: OutboxOp
  ids: string[] // row ids (or card ids for delete_by_card)
  rows?: Record<string, unknown>[] // supabase row objects, only for upsert
  attempts: number
  createdAt: number
}

export class LingoDatabase extends Dexie {
  decks!: EntityTable<Deck, 'id'>
  cards!: EntityTable<Card, 'id'>
  reviewLogs!: EntityTable<ReviewLog, 'id'>
  settings!: EntityTable<Settings, 'id'>
  outbox!: EntityTable<OutboxEntry, 'seq'>

  constructor() {
    super('lingo-cards')
    this.version(1).stores({
      decks: 'id, name, createdAt',
      cards: 'id, deckId, state, due, [deckId+state], [deckId+due], *tags, front, createdAt, updatedAt',
      reviewLogs: 'id, cardId, deckId, reviewedAt',
      settings: 'id',
    })
    this.version(2).stores({
      decks: 'id, name, createdAt',
      cards: 'id, deckId, state, due, [deckId+state], [deckId+due], *tags, front, createdAt, updatedAt',
      reviewLogs: 'id, cardId, deckId, reviewedAt',
      settings: 'id',
      outbox: '++seq, createdAt',
    })
  }
}

export const db = new LingoDatabase()
