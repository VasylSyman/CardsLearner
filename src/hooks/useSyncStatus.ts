import { useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db'
import { getSyncStatus, subscribeSyncStatus } from '@/db/syncEngine'
import type { SyncStatus } from '@/db/syncEngine'

export function useSyncStatus(): SyncStatus & { pending: number } {
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus)
  const pending = useLiveQuery(() => db.outbox.count(), [], 0) ?? 0
  return { ...status, pending }
}
