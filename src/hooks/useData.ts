import { useLiveQuery } from 'dexie-react-hooks'
import { db, repo } from '@/db'
import { DEFAULT_SETTINGS } from '@/db/dexieRepository'
import type { Card, Deck, Settings } from '@/db/types'
import type { DueCounts } from '@/db/repository'

export function useDecks(): Deck[] | undefined {
  return useLiveQuery(() => db.decks.orderBy('createdAt').toArray(), [])
}

export function useDeck(id?: string): Deck | undefined {
  return useLiveQuery(() => (id ? db.decks.get(id) : undefined), [id])
}

export function useCards(deckId?: string): Card[] | undefined {
  return useLiveQuery(
    () => (deckId ? db.cards.where('deckId').equals(deckId).toArray() : db.cards.toArray()),
    [deckId],
  )
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => {
    const s = await db.settings.get('app')
    return { ...DEFAULT_SETTINGS, ...s }
  }, [])
}

export function useDueCounts(deckId?: string): DueCounts | undefined {
  return useLiveQuery(async () => {
    if (!deckId) return undefined
    return repo.getDueCounts(deckId)
  }, [deckId])
}

export function useAllDueCounts(): Record<string, DueCounts> | undefined {
  return useLiveQuery(async () => {
    const decks = await db.decks.toArray()
    const entries = await Promise.all(decks.map(async (d) => [d.id, await repo.getDueCounts(d.id)] as const))
    return Object.fromEntries(entries)
  }, [])
}

export function useAllTags(): string[] | undefined {
  return useLiveQuery(async () => {
    const keys = await db.cards.orderBy('tags').uniqueKeys()
    return keys.map(String).sort()
  }, [])
}
