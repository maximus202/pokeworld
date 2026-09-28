import type { Database } from 'better-sqlite3'

export interface CaughtEntry {
  name: string
  /** ISO 8601 UTC, e.g. 2026-09-28T14:03:11.402Z */
  caughtAt: string
}

export interface CollectionStore {
  /** The visitor's caught Pokemon, most recently caught first. */
  list(visitorId: string): CaughtEntry[]
  /**
   * Catches a Pokemon. Idempotent: an already-caught Pokemon returns its existing entry (and keeps
   * its original date). Returns 'full' when a new catch would exceed the visitor's cap.
   */
  add(visitorId: string, name: string): CaughtEntry | 'full'
  remove(visitorId: string, name: string): void
  reset(visitorId: string): void
  close(): void
}

export interface CollectionStoreOptions {
  /** Injectable clock, so tests control `caughtAt`. */
  now?: () => Date
  /** Most Pokemon one visitor can hold. */
  maxSize?: number
}

export const DEFAULT_MAX_COLLECTION_SIZE = 1000

/**
 * All SQL for the collection lives here. Every query is scoped by visitor_id and parameterised.
 * `caught_at` is stored as an ISO 8601 UTC string. SQLite's CURRENT_TIMESTAMP is avoided on
 * purpose: it has no zone, so browsers read it as local time and show the wrong day.
 */
export function createCollectionStore(db: Database, options: CollectionStoreOptions = {}): CollectionStore {
  const now = options.now ?? (() => new Date())
  const maxSize = options.maxSize ?? DEFAULT_MAX_COLLECTION_SIZE

  db.exec(`
    CREATE TABLE IF NOT EXISTS collection (
      visitor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      caught_at TEXT NOT NULL,
      PRIMARY KEY (visitor_id, name)
    )
  `)

  const listStmt = db.prepare(
    'SELECT name, caught_at AS caughtAt FROM collection WHERE visitor_id = ? ORDER BY caught_at DESC, rowid DESC'
  )
  const getStmt = db.prepare('SELECT name, caught_at AS caughtAt FROM collection WHERE visitor_id = ? AND name = ?')
  const countStmt = db.prepare('SELECT COUNT(*) AS n FROM collection WHERE visitor_id = ?')
  const insertStmt = db.prepare('INSERT INTO collection (visitor_id, name, caught_at) VALUES (?, ?, ?)')
  const removeStmt = db.prepare('DELETE FROM collection WHERE visitor_id = ? AND name = ?')
  const resetStmt = db.prepare('DELETE FROM collection WHERE visitor_id = ?')

  const addTx = db.transaction((visitorId: string, name: string): CaughtEntry | 'full' => {
    const existing = getStmt.get(visitorId, name) as CaughtEntry | undefined
    if (existing) return existing
    if ((countStmt.get(visitorId) as { n: number }).n >= maxSize) return 'full'
    const caughtAt = now().toISOString()
    insertStmt.run(visitorId, name, caughtAt)
    return { name, caughtAt }
  })

  return {
    list: visitorId => listStmt.all(visitorId) as CaughtEntry[],
    add: (visitorId, name) => addTx(visitorId, name),
    remove: (visitorId, name) => void removeStmt.run(visitorId, name),
    reset: visitorId => void resetStmt.run(visitorId),
    close: () => void db.close()
  }
}
