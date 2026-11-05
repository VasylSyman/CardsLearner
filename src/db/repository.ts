import type { Card, CardInput, Deck, ExportBundle, Rating, ReviewLog, Settings } from './types'

export interface DueCounts {
  newCount: number
  learnCount: number
  dueCount: number
}

export interface StudyQueue {
  cards: Card[]
  counts: DueCounts
}

/**
 * Storage abstraction. The app only talks to this interface, so swapping
 * Dexie/IndexedDB for Supabase, SQLite or Firebase means implementing
 * this interface once and changing the export in `src/db/index.ts`.
 */
export interface Repository {
  // Decks
  listDecks(): Promise<Deck[]>
  getDeck(id: string): Promise<Deck | undefined>
  createDeck(input: Pick<Deck, 'name'> & Partial<Omit<Deck, 'id' | 'name' | 'createdAt' | 'updatedAt'>>): Promise<Deck>
  updateDeck(id: string, patch: Partial<Omit<Deck, 'id' | 'createdAt'>>): Promise<void>
  deleteDeck(id: string): Promise<void>

  // Cards
  getCard(id: string): Promise<Card | undefined>
  listCards(deckId?: string): Promise<Card[]>
  createCard(input: CardInput): Promise<Card>
  createCards(inputs: CardInput[]): Promise<Card[]>
  updateCard(id: string, patch: Partial<Omit<Card, 'id' | 'createdAt'>>): Promise<void>
  deleteCard(id: string): Promise<void>
  deleteCards(ids: string[]): Promise<void>
  resetCardProgress(ids: string[]): Promise<void>

  // Study
  getStudyQueue(deckId: string, now?: number): Promise<StudyQueue>
  getDueCounts(deckId: string, now?: number): Promise<DueCounts>
  reviewCard(cardId: string, rating: Rating, now?: number): Promise<Card>
  listReviewLogs(deckId?: string, limit?: number): Promise<ReviewLog[]>

  // Settings
  getSettings(): Promise<Settings>
  updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void>

  // Backup
  exportAll(): Promise<ExportBundle>
  importBundle(bundle: ExportBundle, mode: 'merge' | 'replace'): Promise<{ decks: number; cards: number }>
  clearAll(): Promise<void>
}
