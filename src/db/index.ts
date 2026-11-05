import { DexieRepository } from './dexieRepository'
import type { Repository } from './repository'

/**
 * Single swap point for the storage backend.
 * Replace `new DexieRepository()` with e.g. `new SupabaseRepository(client)`
 * once a remote backend is available.
 */
export const repo: Repository = new DexieRepository()

export { db } from './database'
export * from './types'
export type { Repository, DueCounts, StudyQueue } from './repository'
