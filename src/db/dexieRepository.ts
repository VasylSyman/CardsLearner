import { db } from './database'
import type { DueCounts, Repository, StudyQueue } from './repository'
import type { Card, CardInput, Deck, ExportBundle, Rating, ReviewLog, Settings } from './types'
import { endOfToday, newCardSchedulingFields, schedule, startOfToday } from '@/lib/scheduler'
import { uid } from '@/lib/utils'

export const DEFAULT_SETTINGS: Settings = {
  id: 'app',
  theme: 'system',
  ttsEnabled: true,
  ttsRate: 0.9,
  autoPlayAudio: false,
}

function normalizeTags(tags?: string[]): string[] {
  return Array.from(
    new Set((tags ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean)),
  )
}

async function countReviewedToday(deckId: string, state: 'new' | 'review', now: number): Promise<number> {
  const since = startOfToday(now)
  return db.reviewLogs
    .where('deckId')
    .equals(deckId)
    .and((l) => l.reviewedAt >= since && (state === 'new' ? l.state === 'new' : l.state === 'review'))
    .count()
}

export class DexieRepository implements Repository {
  async listDecks(): Promise<Deck[]> {
    return db.decks.orderBy('createdAt').toArray()
  }

  async getDeck(id: string): Promise<Deck | undefined> {
    return db.decks.get(id)
  }

  async createDeck(input: Pick<Deck, 'name'> & Partial<Omit<Deck, 'id' | 'name' | 'createdAt' | 'updatedAt'>>): Promise<Deck> {
    const now = Date.now()
    const deck: Deck = {
      id: uid(),
      name: input.name.trim(),
      description: input.description,
      newPerDay: input.newPerDay ?? 20,
      reviewsPerDay: input.reviewsPerDay ?? 200,
      createdAt: now,
      updatedAt: now,
    }
    await db.decks.add(deck)
    return deck
  }

  async updateDeck(id: string, patch: Partial<Omit<Deck, 'id' | 'createdAt'>>): Promise<void> {
    await db.decks.update(id, { ...patch, updatedAt: Date.now() })
  }

  async deleteDeck(id: string): Promise<void> {
    await db.transaction('rw', db.decks, db.cards, db.reviewLogs, async () => {
      await db.cards.where('deckId').equals(id).delete()
      await db.reviewLogs.where('deckId').equals(id).delete()
      await db.decks.delete(id)
    })
  }

  async getCard(id: string): Promise<Card | undefined> {
    return db.cards.get(id)
  }

  async listCards(deckId?: string): Promise<Card[]> {
    if (deckId) return db.cards.where('deckId').equals(deckId).toArray()
    return db.cards.toArray()
  }

  private buildCard(input: CardInput, now: number): Card {
    return {
      id: uid(),
      deckId: input.deckId,
      front: input.front.trim(),
      context: input.context?.trim() || undefined,
      translationEn: input.translationEn.trim(),
      translationUk: input.translationUk.trim(),
      partOfSpeech: input.partOfSpeech,
      notes: input.notes?.trim() || undefined,
      tags: normalizeTags(input.tags),
      ...newCardSchedulingFields(now),
      createdAt: now,
      updatedAt: now,
    }
  }

  async createCard(input: CardInput): Promise<Card> {
    const card = this.buildCard(input, Date.now())
    await db.cards.add(card)
    return card
  }

  async createCards(inputs: CardInput[]): Promise<Card[]> {
    const now = Date.now()
    const cards = inputs.map((i, idx) => this.buildCard(i, now + idx))
    await db.cards.bulkAdd(cards)
    return cards
  }

  async updateCard(id: string, patch: Partial<Omit<Card, 'id' | 'createdAt'>>): Promise<void> {
    const next = { ...patch, updatedAt: Date.now() }
    if (patch.tags) next.tags = normalizeTags(patch.tags)
    await db.cards.update(id, next)
  }

  async deleteCard(id: string): Promise<void> {
    await db.transaction('rw', db.cards, db.reviewLogs, async () => {
      await db.reviewLogs.where('cardId').equals(id).delete()
      await db.cards.delete(id)
    })
  }

  async deleteCards(ids: string[]): Promise<void> {
    await db.transaction('rw', db.cards, db.reviewLogs, async () => {
      await db.reviewLogs.where('cardId').anyOf(ids).delete()
      await db.cards.bulkDelete(ids)
    })
  }

  async resetCardProgress(ids: string[]): Promise<void> {
    const now = Date.now()
    await db.transaction('rw', db.cards, db.reviewLogs, async () => {
      await db.reviewLogs.where('cardId').anyOf(ids).delete()
      await Promise.all(
        ids.map((id) =>
          db.cards.update(id, { ...newCardSchedulingFields(now), lastReview: undefined, updatedAt: now }),
        ),
      )
    })
  }

  async getDueCounts(deckId: string, now = Date.now()): Promise<DueCounts> {
    const { counts } = await this.getStudyQueue(deckId, now)
    return counts
  }

  async getStudyQueue(deckId: string, now = Date.now()): Promise<StudyQueue> {
    const deck = await db.decks.get(deckId)
    const newLimit = deck?.newPerDay ?? 20
    const reviewLimit = deck?.reviewsPerDay ?? 200
    const dayEnd = endOfToday(now)

    const [newDoneToday, reviewDoneToday] = await Promise.all([
      countReviewedToday(deckId, 'new', now),
      countReviewedToday(deckId, 'review', now),
    ])

    const all = await db.cards.where('deckId').equals(deckId).toArray()

    const learning = all
      .filter((c) => (c.state === 'learning' || c.state === 'relearning') && c.due <= dayEnd)
      .sort((a, b) => a.due - b.due)

    const review = all
      .filter((c) => c.state === 'review' && c.due <= dayEnd)
      .sort((a, b) => a.due - b.due)
      .slice(0, Math.max(0, reviewLimit - reviewDoneToday))

    const fresh = all
      .filter((c) => c.state === 'new')
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, Math.max(0, newLimit - newDoneToday))

    const counts: DueCounts = {
      newCount: fresh.length,
      learnCount: learning.length,
      dueCount: review.length,
    }

    // Interleave: learning cards that are already due first, then reviews, then new.
    const dueLearning = learning.filter((c) => c.due <= now)
    const futureLearning = learning.filter((c) => c.due > now)
    const cards = [...dueLearning, ...review, ...fresh, ...futureLearning]

    return { cards, counts }
  }

  async reviewCard(cardId: string, rating: Rating, now = Date.now()): Promise<Card> {
    return db.transaction('rw', db.cards, db.reviewLogs, async () => {
      const card = await db.cards.get(cardId)
      if (!card) throw new Error(`Card ${cardId} not found`)
      const result = schedule(card, rating, now)
      const log: ReviewLog = {
        id: uid(),
        cardId,
        deckId: card.deckId,
        rating,
        state: card.state,
        interval: result.interval,
        easeFactor: result.easeFactor,
        reviewedAt: now,
      }
      const updated: Card = { ...card, ...result, updatedAt: now }
      await db.cards.put(updated)
      await db.reviewLogs.add(log)
      return updated
    })
  }

  async listReviewLogs(deckId?: string, limit = 500): Promise<ReviewLog[]> {
    const coll = deckId
      ? db.reviewLogs.where('deckId').equals(deckId)
      : db.reviewLogs.orderBy('reviewedAt')
    return coll.reverse().limit(limit).toArray()
  }

  async getSettings(): Promise<Settings> {
    const s = await db.settings.get('app')
    if (s) return { ...DEFAULT_SETTINGS, ...s }
    await db.settings.put(DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS
  }

  async updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
    const current = await this.getSettings()
    await db.settings.put({ ...current, ...patch, id: 'app' })
  }

  async exportAll(): Promise<ExportBundle> {
    const [decks, cards, reviewLogs] = await Promise.all([
      db.decks.toArray(),
      db.cards.toArray(),
      db.reviewLogs.toArray(),
    ])
    return { version: 1, exportedAt: new Date().toISOString(), decks, cards, reviewLogs }
  }

  async importBundle(bundle: ExportBundle, mode: 'merge' | 'replace'): Promise<{ decks: number; cards: number }> {
    return db.transaction('rw', db.decks, db.cards, db.reviewLogs, async () => {
      if (mode === 'replace') {
        await Promise.all([db.decks.clear(), db.cards.clear(), db.reviewLogs.clear()])
      }
      await db.decks.bulkPut(bundle.decks)
      await db.cards.bulkPut(bundle.cards.map((c) => ({ ...c, tags: normalizeTags(c.tags) })))
      if (bundle.reviewLogs?.length) await db.reviewLogs.bulkPut(bundle.reviewLogs)
      return { decks: bundle.decks.length, cards: bundle.cards.length }
    })
  }

  async clearAll(): Promise<void> {
    await db.transaction('rw', db.decks, db.cards, db.reviewLogs, db.settings, async () => {
      await Promise.all([db.decks.clear(), db.cards.clear(), db.reviewLogs.clear(), db.settings.clear()])
    })
  }
}
