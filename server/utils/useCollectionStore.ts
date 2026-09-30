import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { CollectionStore } from './collectionStore'

let store: CollectionStore | undefined

/** The collection store, opened on first use from `runtimeConfig.dbPath`. */
export function useCollectionStore(): CollectionStore {
  if (!store) {
    const { dbPath, maxCollectionSize } = useRuntimeConfig()
    if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true })
    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    store = createCollectionStore(db, { maxSize: Number(maxCollectionSize) }) // an environment variable arrives as text
  }
  return store
}
