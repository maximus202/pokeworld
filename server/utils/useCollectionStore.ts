import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { assertValidCap, createCollectionStore, type CollectionStore } from './collectionStore'

/** Opens the database and the store. The cap is checked first, so a bad value never opens the file. */
export function openCollectionStore(dbPath: string, maxSize: number): CollectionStore {
  assertValidCap(maxSize)
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true })
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  return createCollectionStore(db, { maxSize })
}

let store: CollectionStore | undefined

/** The collection store, opened on first use from `runtimeConfig`. */
export function useCollectionStore(): CollectionStore {
  if (!store) {
    const { dbPath, maxCollectionSize } = useRuntimeConfig()
    store = openCollectionStore(dbPath, Number(maxCollectionSize)) // an environment variable arrives as text
  }
  return store
}
