import Dexie from 'dexie'
import type { PostgrestResponse } from '@supabase/supabase-js'
import type { RealtimePostgresChangesPayload } from '@supabase/realtime-js'
import { db } from './database'
import type { OutboxEntry } from './database'
import { isCloudConfigured, supabase } from './supabaseClient'
import type { CardRow, DeckRow, ReviewLogRow } from './supabaseMapping'
import { cardToRow, deckToRow, logToRow, rowToCard, rowToDeck, rowToLog } from './supabaseMapping'

export type SyncPhase = 'local' | 'loading' | 'synced' | 'syncing' | 'offline' | 'error'

export interface SyncStatus {
  configured: boolean
  phase: SyncPhase
  lastSyncedAt?: number
  error?: string
}

let status: SyncStatus = { configured: isCloudConfigured, phase: isCloudConfigured ? 'loading' : 'local' }
const statusListeners = new Set<() => void>()

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeSyncStatus(cb: () => void): () => void {
  statusListeners.add(cb)
  return () => {
    statusListeners.delete(cb)
  }
}

function setStatus(patch: Partial<SyncStatus>): void {
  status = { ...status, ...patch }
  statusListeners.forEach((cb) => cb())
}

let flushing = false
let rerun = false
let realtimeStarted = false
let lastCloudEmpty = false
let retryInterval: ReturnType<typeof setInterval> | null = null

/** Add an entry to the outbox and schedule a flush. No-op when cloud sync is not configured. */
export async function enqueue(entry: Omit<OutboxEntry, 'seq' | 'attempts' | 'createdAt'>): Promise<void> {
  if (!isCloudConfigured) return
  await db.outbox.add({ ...entry, attempts: 0, createdAt: Date.now() })
  scheduleFlush()
}

function scheduleFlush(): void {
  Dexie.ignoreTransaction(() => {
    setTimeout(() => void flush(), 0)
  })
}

/** Push queued outbox entries to the cloud in seq order. */
export async function flush(): Promise<void> {
  if (!isCloudConfigured) return
  if (flushing) {
    rerun = true
    return
  }
  flushing = true
  try {
    do {
      rerun = false
      await flushOnce()
    } while (rerun)
  } finally {
    flushing = false
  }
}

async function flushOnce(): Promise<void> {
  if (!supabase) return
  if (!navigator.onLine) {
    if ((await db.outbox.count()) > 0) setStatus({ phase: 'offline' })
    return
  }
  const entries = await db.outbox.orderBy('seq').toArray()
  if (entries.length === 0) return
  setStatus({ phase: 'syncing' })
  for (const entry of entries) {
    const error = await processEntry(entry)
    if (error !== null) {
      await db.outbox.update(entry.seq!, { attempts: entry.attempts + 1 })
      setStatus({ phase: 'error', error })
      return
    }
    await db.outbox.delete(entry.seq!)
  }
  setStatus({ phase: 'synced', lastSyncedAt: Date.now(), error: undefined })
}

const FK_VIOLATION = '23503'

async function existingIds(table: 'decks' | 'cards', ids: string[]): Promise<Set<string>> {
  const found = new Set<string>()
  for (let i = 0; i < ids.length; i += 500) {
    const { data, error } = await supabase!.from(table).select('id').in('id', ids.slice(i, i + 500))
    if (error) throw new Error(error.message)
    for (const row of data ?? []) found.add(String(row.id))
  }
  return found
}

async function upsertRows(table: OutboxEntry['table'], rows: Record<string, unknown>[]): Promise<string | null> {
  if (rows.length === 0) return null
  const { error } = await supabase!.from(table).upsert(rows, { onConflict: 'id' })
  if (!error) return null
  if (error.code !== FK_VIOLATION) return error.message

  if (table === 'review_logs') {
    const cardIds = Array.from(new Set(rows.map((r) => String(r.card_id))))
    const present = await existingIds('cards', cardIds)
    const valid = rows.filter((r) => present.has(String(r.card_id)))
    console.warn(`[sync] skipping ${rows.length - valid.length} review log(s) whose card no longer exists`)
    return upsertRowsOnce(table, valid)
  }
  if (table === 'cards') {
    const deckIds = Array.from(new Set(rows.map((r) => String(r.deck_id))))
    const present = await existingIds('decks', deckIds)
    const missing = deckIds.filter((id) => !present.has(id))
    const decks = await db.decks.where('id').anyOf(missing).toArray()
    const deckErr = await upsertRowsOnce('decks', decks.map((d) => deckToRow(d) as unknown as Record<string, unknown>))
    if (deckErr) return deckErr
    const known = new Set([...present, ...decks.map((d) => d.id)])
    const valid = rows.filter((r) => known.has(String(r.deck_id)))
    if (valid.length < rows.length) console.warn(`[sync] skipping ${rows.length - valid.length} card(s) whose deck no longer exists`)
    return upsertRowsOnce(table, valid)
  }
  return error.message
}

async function upsertRowsOnce(table: OutboxEntry['table'], rows: Record<string, unknown>[]): Promise<string | null> {
  if (rows.length === 0) return null
  const { error } = await supabase!.from(table).upsert(rows, { onConflict: 'id' })
  return error ? error.message : null
}

async function processEntry(entry: OutboxEntry): Promise<string | null> {
  if (!supabase) return 'cloud client unavailable'
  try {
    if (entry.op === 'upsert') {
      const rows = entry.rows ?? []
      for (let i = 0; i < rows.length; i += 500) {
        const err = await upsertRows(entry.table, rows.slice(i, i + 500))
        if (err) return err
      }
    } else if (entry.op === 'delete') {
      for (let i = 0; i < entry.ids.length; i += 500) {
        const { error } = await supabase.from(entry.table).delete().in('id', entry.ids.slice(i, i + 500))
        if (error) return error.message
      }
    } else {
      const { error } = await supabase.from('review_logs').delete().in('card_id', entry.ids)
      if (error) return error.message
    }
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'unknown sync error'
  }
}

async function fetchAllRows<Row>(make: (from: number, to: number) => PromiseLike<PostgrestResponse<Row>>): Promise<Row[]> {
  const rows: Row[] = []
  let from = 0
  for (;;) {
    const { data, error } = await make(from, from + 999)
    if (error) throw new Error(error.message)
    if (!data) break
    rows.push(...data)
    if (data.length < 1000) break
    from += 1000
  }
  return rows
}

/** Pull all cloud rows into the local Dexie cache (cloud-authoritative for missing local rows). */
export async function pullFromCloud(): Promise<boolean> {
  if (!isCloudConfigured || !supabase) return false
  try {
    const decks = await fetchAllRows<DeckRow>((from, to) => supabase!.from('decks').select('*').range(from, to))
    const cards = await fetchAllRows<CardRow>((from, to) => supabase!.from('cards').select('*').range(from, to))
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const logs = await fetchAllRows<ReviewLogRow>((from, to) =>
      supabase!.from('review_logs').select('*').gte('reviewed_at', since).range(from, to),
    )
    lastCloudEmpty = decks.length === 0 && cards.length === 0

    await db.transaction('rw', db.decks, db.cards, db.reviewLogs, db.outbox, async () => {
      const outbox = await db.outbox.toArray()
      const pendingIds = new Set<string>()
      for (const e of outbox) {
        for (const id of e.ids) pendingIds.add(id)
        for (const row of e.rows ?? []) {
          if (typeof row.id === 'string') pendingIds.add(row.id)
        }
      }

      const cloudDeckIds = new Set<string>()
      for (const row of decks) {
        cloudDeckIds.add(row.id)
        const local = await db.decks.get(row.id)
        if (!local || Date.parse(row.updated_at) >= local.updatedAt) await db.decks.put(rowToDeck(row))
      }

      const cloudCardIds = new Set<string>()
      for (const row of cards) {
        cloudCardIds.add(row.id)
        const local = await db.cards.get(row.id)
        if (!local || Date.parse(row.updated_at) >= local.updatedAt) await db.cards.put(rowToCard(row))
      }

      if (logs.length > 0) await db.reviewLogs.bulkPut(logs.map(rowToLog))

      if (!lastCloudEmpty) {
        const localDecks = await db.decks.toArray()
        const deleted = localDecks.map((d) => d.id).filter((id) => !cloudDeckIds.has(id) && !pendingIds.has(id))
        if (deleted.length > 0) await db.decks.bulkDelete(deleted)
      }
      if (!lastCloudEmpty) {
        const localCards = await db.cards.toArray()
        const deleted = localCards.map((c) => c.id).filter((id) => !cloudCardIds.has(id) && !pendingIds.has(id))
        if (deleted.length > 0) {
          await db.reviewLogs.where('cardId').anyOf(deleted).delete()
          await db.cards.bulkDelete(deleted)
        }
      }
    })

    setStatus({ phase: 'synced', lastSyncedAt: Date.now(), error: undefined })
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : 'pull failed'
    setStatus({ phase: navigator.onLine ? 'error' : 'offline', error: message })
    return false
  }
}

/** Upload every local deck, card and review log to the cloud. */
export async function pushAllLocal(): Promise<{ decks: number; cards: number; logs: number }> {
  if (!isCloudConfigured) return { decks: 0, cards: 0, logs: 0 }
  const decks = await db.decks.toArray()
  const cards = await db.cards.toArray()
  const logs = await db.reviewLogs.toArray()

  if (decks.length > 0) {
    const rows = decks.map((d) => deckToRow(d) as unknown as Record<string, unknown>)
    await enqueue({ table: 'decks', op: 'upsert', ids: rows.map((r) => String(r.id)), rows })
  }
  for (let i = 0; i < cards.length; i += 500) {
    const chunk = cards.slice(i, i + 500)
    const rows = chunk.map((c) => cardToRow(c) as unknown as Record<string, unknown>)
    await enqueue({ table: 'cards', op: 'upsert', ids: rows.map((r) => String(r.id)), rows })
  }
  for (let i = 0; i < logs.length; i += 500) {
    const chunk = logs.slice(i, i + 500)
    const rows = chunk.map((l) => logToRow(l) as unknown as Record<string, unknown>)
    await enqueue({ table: 'review_logs', op: 'upsert', ids: rows.map((r) => String(r.id)), rows })
  }
  await flush()
  return { decks: decks.length, cards: cards.length, logs: logs.length }
}

async function handlePostgresChange(
  table: 'decks' | 'cards' | 'review_logs',
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): Promise<void> {
  try {
    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
      if (table === 'decks') {
        const row = payload.new as unknown as DeckRow
        const local = await db.decks.get(row.id)
        if (!local || Date.parse(row.updated_at) >= local.updatedAt) await db.decks.put(rowToDeck(row))
      } else if (table === 'cards') {
        const row = payload.new as unknown as CardRow
        const local = await db.cards.get(row.id)
        if (!local || Date.parse(row.updated_at) >= local.updatedAt) await db.cards.put(rowToCard(row))
      } else {
        await db.reviewLogs.put(rowToLog(payload.new as unknown as ReviewLogRow))
      }
    } else {
      const id = payload.old.id
      if (typeof id !== 'string') return
      if (table === 'decks') {
        await db.transaction('rw', db.decks, db.cards, db.reviewLogs, async () => {
          await db.cards.where('deckId').equals(id).delete()
          await db.reviewLogs.where('deckId').equals(id).delete()
          await db.decks.delete(id)
        })
      } else if (table === 'cards') {
        await db.transaction('rw', db.cards, db.reviewLogs, async () => {
          await db.reviewLogs.where('cardId').equals(id).delete()
          await db.cards.delete(id)
        })
      } else {
        await db.reviewLogs.delete(id)
      }
    }
  } catch (err) {
    console.error('[sync] realtime handler failed', err)
  }
}

function subscribeRealtime(): void {
  if (!isCloudConfigured || !supabase || realtimeStarted) return
  realtimeStarted = true
  const channel = supabase.channel('lingo-sync')
  for (const table of ['decks', 'cards', 'review_logs'] as const) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      void handlePostgresChange(table, payload)
    })
  }
  let wasSubscribed = false
  channel.subscribe((state) => {
    if (state !== 'SUBSCRIBED') return
    if (wasSubscribed) void flush().then(() => pullFromCloud())
    wasSubscribed = true
  })
}

async function resync(): Promise<void> {
  await flush()
  await pullFromCloud()
}

/** Boot the sync engine: attach listeners, flush the outbox, pull, migrate local data, subscribe to realtime. */
export async function startSync(): Promise<boolean> {
  if (!isCloudConfigured) return false
  if (realtimeStarted) return true

  if (retryInterval === null) {
    retryInterval = setInterval(() => {
      void db.outbox.count().then((n) => {
        if (n > 0) void flush()
      })
    }, 30000)
  }
  window.addEventListener('online', () => void resync())
  window.addEventListener('offline', () => setStatus({ phase: 'offline' }))

  await flush()
  const pulled = await pullFromCloud()
  if (pulled && lastCloudEmpty && (await db.decks.count()) > 0) {
    await pushAllLocal()
  }
  subscribeRealtime()
  return pulled
}

export { isCloudConfigured }
