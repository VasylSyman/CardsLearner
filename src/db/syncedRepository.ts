import { db } from './database'
import { DexieRepository } from './dexieRepository'
import type { DueCounts, Repository, StudyQueue } from './repository'
import type { Card, CardInput, Deck, ExportBundle, Rating, ReviewLog, Settings } from './types'
import { enqueue } from './syncEngine'
import { cardToRow, deckToRow, logToRow } from './supabaseMapping'

async function chunkedEnqueue(
  table: 'decks' | 'cards' | 'review_logs',
  rows: { id: string }[],
): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500)
    await enqueue({
      table,
      op: 'upsert',
      ids: chunk.map((r) => r.id),
      rows: chunk as unknown as Record<string, unknown>[],
    })
  }
}

export class SyncedRepository implements Repository {
  private inner = new DexieRepository()

  // Decks
  listDecks(): Promise<Deck[]> {
    return this.inner.listDecks()
  }

  getDeck(id: string): Promise<Deck | undefined> {
    return this.inner.getDeck(id)
  }

  async createDeck(input: Pick<Deck, 'name'> & Partial<Omit<Deck, 'id' | 'name' | 'createdAt' | 'updatedAt'>>): Promise<Deck> {
    const deck = await this.inner.createDeck(input)
    await chunkedEnqueue('decks', [deckToRow(deck)])
    return deck
  }

  async updateDeck(id: string, patch: Partial<Omit<Deck, 'id' | 'createdAt'>>): Promise<void> {
    await this.inner.updateDeck(id, patch)
    const deck = await db.decks.get(id)
    if (deck) await chunkedEnqueue('decks', [deckToRow(deck)])
  }

  async deleteDeck(id: string): Promise<void> {
    await this.inner.deleteDeck(id)
    await enqueue({ table: 'decks', op: 'delete', ids: [id] })
  }

  // Cards
  getCard(id: string): Promise<Card | undefined> {
    return this.inner.getCard(id)
  }

  listCards(deckId?: string): Promise<Card[]> {
    return this.inner.listCards(deckId)
  }

  async createCard(input: CardInput): Promise<Card> {
    const card = await this.inner.createCard(input)
    await chunkedEnqueue('cards', [cardToRow(card)])
    return card
  }

  async createCards(inputs: CardInput[]): Promise<Card[]> {
    const cards = await this.inner.createCards(inputs)
    await chunkedEnqueue('cards', cards.map(cardToRow))
    return cards
  }

  async updateCard(id: string, patch: Partial<Omit<Card, 'id' | 'createdAt'>>): Promise<void> {
    await this.inner.updateCard(id, patch)
    const card = await db.cards.get(id)
    if (card) await chunkedEnqueue('cards', [cardToRow(card)])
  }

  async deleteCard(id: string): Promise<void> {
    await this.inner.deleteCard(id)
    await enqueue({ table: 'cards', op: 'delete', ids: [id] })
  }

  async deleteCards(ids: string[]): Promise<void> {
    await this.inner.deleteCards(ids)
    await enqueue({ table: 'cards', op: 'delete', ids })
  }

  async resetCardProgress(ids: string[]): Promise<void> {
    await this.inner.resetCardProgress(ids)
    await enqueue({ table: 'review_logs', op: 'delete_by_card', ids })
    const cards = await db.cards.where('id').anyOf(ids).toArray()
    if (cards.length > 0) await chunkedEnqueue('cards', cards.map(cardToRow))
  }

  // Study
  getStudyQueue(deckId: string, now?: number): Promise<StudyQueue> {
    return this.inner.getStudyQueue(deckId, now)
  }

  getDueCounts(deckId: string, now?: number): Promise<DueCounts> {
    return this.inner.getDueCounts(deckId, now)
  }

  async reviewCard(cardId: string, rating: Rating, now?: number): Promise<Card> {
    const updated = await this.inner.reviewCard(cardId, rating, now)
    await chunkedEnqueue('cards', [cardToRow(updated)])
    const logs = await db.reviewLogs.where('cardId').equals(cardId).toArray()
    const log = logs.sort((a, b) => b.reviewedAt - a.reviewedAt)[0]
    if (log) await chunkedEnqueue('review_logs', [logToRow(log)])
    return updated
  }

  listReviewLogs(deckId?: string, limit?: number): Promise<ReviewLog[]> {
    return this.inner.listReviewLogs(deckId, limit)
  }

  // Settings (local only)
  getSettings(): Promise<Settings> {
    return this.inner.getSettings()
  }

  updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
    return this.inner.updateSettings(patch)
  }

  // Backup
  exportAll(): Promise<ExportBundle> {
    return this.inner.exportAll()
  }

  async importBundle(bundle: ExportBundle, mode: 'merge' | 'replace'): Promise<{ decks: number; cards: number }> {
    let existingDeckIds: string[] = []
    let existingCardIds: string[] = []
    if (mode === 'replace') {
      const [decks, cards] = await Promise.all([db.decks.toArray(), db.cards.toArray()])
      existingDeckIds = decks.map((d) => d.id)
      existingCardIds = cards.map((c) => c.id)
    }
    const result = await this.inner.importBundle(bundle, mode)
    if (mode === 'replace') {
      if (existingDeckIds.length > 0) await enqueue({ table: 'decks', op: 'delete', ids: existingDeckIds })
      if (existingCardIds.length > 0) await enqueue({ table: 'cards', op: 'delete', ids: existingCardIds })
    }
    if (bundle.decks.length > 0) await chunkedEnqueue('decks', bundle.decks.map(deckToRow))
    if (bundle.cards.length > 0) await chunkedEnqueue('cards', bundle.cards.map(cardToRow))
    if (bundle.reviewLogs?.length) await chunkedEnqueue('review_logs', bundle.reviewLogs.map(logToRow))
    return result
  }

  async clearAll(): Promise<void> {
    const [decks, cards] = await Promise.all([db.decks.toArray(), db.cards.toArray()])
    const deckIds = decks.map((d) => d.id)
    const cardIds = cards.map((c) => c.id)
    await this.inner.clearAll()
    if (deckIds.length > 0) await enqueue({ table: 'decks', op: 'delete', ids: deckIds })
    if (cardIds.length > 0) await enqueue({ table: 'cards', op: 'delete', ids: cardIds })
  }
}
