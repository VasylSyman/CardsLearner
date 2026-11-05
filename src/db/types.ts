export type CardState = 'new' | 'learning' | 'review' | 'relearning'

export type Rating = 1 | 2 | 3 | 4

export const RATING_LABELS: Record<Rating, 'Again' | 'Hard' | 'Good' | 'Easy'> = {
  1: 'Again',
  2: 'Hard',
  3: 'Good',
  4: 'Easy',
}

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'preposition'
  | 'conjunction'
  | 'interjection'
  | 'phrase'
  | 'other'

export const PARTS_OF_SPEECH: PartOfSpeech[] = [
  'noun',
  'verb',
  'adjective',
  'adverb',
  'pronoun',
  'preposition',
  'conjunction',
  'interjection',
  'phrase',
  'other',
]

export interface Deck {
  id: string
  name: string
  description?: string
  newPerDay: number
  reviewsPerDay: number
  createdAt: number
  updatedAt: number
}

export interface Card {
  id: string
  deckId: string
  front: string
  context?: string
  translationEn: string
  translationUk: string
  partOfSpeech?: PartOfSpeech
  notes?: string
  tags: string[]

  state: CardState
  due: number
  interval: number
  easeFactor: number
  reps: number
  lapses: number
  learningStep: number
  lastReview?: number

  createdAt: number
  updatedAt: number
}

export interface ReviewLog {
  id: string
  cardId: string
  deckId: string
  rating: Rating
  state: CardState
  interval: number
  easeFactor: number
  reviewedAt: number
}

export interface Settings {
  id: 'app'
  theme: 'light' | 'dark' | 'system'
  ttsEnabled: boolean
  ttsVoiceUri?: string
  ttsRate: number
  autoPlayAudio: boolean
  lastDeckId?: string
}

export type CardInput = Pick<
  Card,
  'deckId' | 'front' | 'translationEn' | 'translationUk'
> &
  Partial<Pick<Card, 'context' | 'partOfSpeech' | 'notes' | 'tags'>>

export interface ExportBundle {
  version: 1
  exportedAt: string
  decks: Deck[]
  cards: Card[]
  reviewLogs?: ReviewLog[]
}
