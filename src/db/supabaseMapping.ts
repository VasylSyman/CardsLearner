import type { Card, CardState, Deck, PartOfSpeech, Rating, ReviewLog } from './types'

export interface DeckRow {
  id: string
  name: string
  description: string | null
  new_per_day: number
  reviews_per_day: number
  created_at: string
  updated_at: string
}

export interface CardRow {
  id: string
  deck_id: string
  spanish: string
  example_sentence: string | null
  english: string
  ukrainian: string
  part_of_speech: string | null
  notes: string | null
  tags: string[]
  state: string
  next_review_at: string
  interval: number
  ease_factor: number
  repetitions: number
  lapses: number
  learning_step: number
  last_review_at: string | null
  created_at: string
  updated_at: string
}

export interface ReviewLogRow {
  id: string
  card_id: string
  deck_id: string
  rating: number
  state: string
  interval: number
  ease_factor: number
  reviewed_at: string
}

export function deckToRow(deck: Deck): DeckRow {
  return {
    id: deck.id,
    name: deck.name,
    description: deck.description ?? null,
    new_per_day: deck.newPerDay,
    reviews_per_day: deck.reviewsPerDay,
    created_at: new Date(deck.createdAt).toISOString(),
    updated_at: new Date(deck.updatedAt).toISOString(),
  }
}

export function rowToDeck(row: DeckRow): Deck {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    newPerDay: row.new_per_day,
    reviewsPerDay: row.reviews_per_day,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  }
}

export function cardToRow(card: Card): CardRow {
  return {
    id: card.id,
    deck_id: card.deckId,
    spanish: card.front,
    example_sentence: card.context ?? null,
    english: card.translationEn,
    ukrainian: card.translationUk,
    part_of_speech: card.partOfSpeech ?? null,
    notes: card.notes ?? null,
    tags: card.tags,
    state: card.state,
    next_review_at: new Date(card.due).toISOString(),
    interval: card.interval,
    ease_factor: card.easeFactor,
    repetitions: card.reps,
    lapses: card.lapses,
    learning_step: card.learningStep,
    last_review_at: card.lastReview ? new Date(card.lastReview).toISOString() : null,
    created_at: new Date(card.createdAt).toISOString(),
    updated_at: new Date(card.updatedAt).toISOString(),
  }
}

export function rowToCard(row: CardRow): Card {
  return {
    id: row.id,
    deckId: row.deck_id,
    front: row.spanish,
    context: row.example_sentence ?? undefined,
    translationEn: row.english,
    translationUk: row.ukrainian,
    partOfSpeech: row.part_of_speech as PartOfSpeech | undefined,
    notes: row.notes ?? undefined,
    tags: row.tags ?? [],
    state: row.state as CardState,
    due: Date.parse(row.next_review_at),
    interval: row.interval,
    easeFactor: row.ease_factor,
    reps: row.repetitions,
    lapses: row.lapses,
    learningStep: row.learning_step,
    lastReview: row.last_review_at ? Date.parse(row.last_review_at) : undefined,
    createdAt: Date.parse(row.created_at),
    updatedAt: Date.parse(row.updated_at),
  }
}

export function logToRow(log: ReviewLog): ReviewLogRow {
  return {
    id: log.id,
    card_id: log.cardId,
    deck_id: log.deckId,
    rating: log.rating,
    state: log.state,
    interval: log.interval,
    ease_factor: log.easeFactor,
    reviewed_at: new Date(log.reviewedAt).toISOString(),
  }
}

export function rowToLog(row: ReviewLogRow): ReviewLog {
  return {
    id: row.id,
    cardId: row.card_id,
    deckId: row.deck_id,
    rating: row.rating as Rating,
    state: row.state as CardState,
    interval: row.interval,
    easeFactor: row.ease_factor,
    reviewedAt: Date.parse(row.reviewed_at),
  }
}
