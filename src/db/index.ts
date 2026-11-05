import { SyncedRepository } from './syncedRepository'
import type { Repository } from './repository'

/**
 * Single swap point for the storage backend.
 * `SyncedRepository` wraps Dexie with a cloud outbox edge; when the Supabase
 * env vars are absent it behaves exactly like the plain Dexie repository.
 */
export const repo: Repository = new SyncedRepository()

export { isCloudConfigured } from './supabaseClient'
export { db } from './database'
export * from './types'
export type { Repository, DueCounts, StudyQueue } from './repository'
