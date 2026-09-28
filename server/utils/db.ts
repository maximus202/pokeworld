import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { createCollectionStore, type CollectionStore } from './collectionStore'

let store: CollectionStore | undefined

/** Lazily opens the SQLite file from runtimeConfig.dbPath (":memory:" is allowed). */
export function useCollectionStore(): CollectionStore {
  if (!store) {
    const { dbPath, maxCollectionSize } = useRuntimeConfig()
    if (dbPath !== ':memory:') {
      mkdirSync(dirname(dbPath), { recursive: true })
    }
    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    store = createCollectionStore(db, { maxSize: Number(maxCollectionSize) })
  }
  return store
}
