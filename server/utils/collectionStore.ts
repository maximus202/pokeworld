import type { Database } from 'better-sqlite3'

export interface CaughtEntry {
  name: string
  /** ISO 8601 UTC, e.g. 2026-09-28T14:03:11.402Z */
  caughtAt: string
}

export interface CollectionStoreOptions {
  /** Injectable so tests control the clock. */
  now?: () => Date
  /** Most Pokemon one visitor can hold. */
  maxSize: number
}

/**
 * All collection SQL. Every query is scoped to one visitor and parameterised. `caught_at` is set
 * here as an ISO string; SQLite's CURRENT_TIMESTAMP has no zone, which browsers show on the wrong day.
 */
export function createCollectionStore(db: Database, { now = () => new Date(), maxSize }: CollectionStoreOptions) {
  // A cap of NaN (say NUXT_MAX_COLLECTION_SIZE=abc) would make `count >= maxSize` always false and
  // quietly remove the limit, so refuse to start with one.
  if (!Number.isInteger(maxSize) || maxSize < 1) {
    throw new Error(`The collection size cap (maxSize, from NUXT_MAX_COLLECTION_SIZE) must be a whole number of at least 1, got ${maxSize}`)
  }
  db.exec(`CREATE TABLE IF NOT EXISTS collection (
    visitor_id TEXT NOT NULL,
    name       TEXT NOT NULL,
    caught_at  TEXT NOT NULL,
    PRIMARY KEY (visitor_id, name)
  )`)

  const find = db.prepare('SELECT name, caught_at AS caughtAt FROM collection WHERE visitor_id = ? AND name = ?')
  const count = db.prepare('SELECT COUNT(*) AS n FROM collection WHERE visitor_id = ?').pluck()
  const insert = db.prepare('INSERT INTO collection (visitor_id, name, caught_at) VALUES (?, ?, ?)')
  const all = db.prepare('SELECT name, caught_at AS caughtAt FROM collection WHERE visitor_id = ? ORDER BY caught_at DESC, name')
  const remove = db.prepare('DELETE FROM collection WHERE visitor_id = ? AND name = ?')
  const reset = db.prepare('DELETE FROM collection WHERE visitor_id = ?')

  const add = db.transaction((visitorId: string, name: string): CaughtEntry | 'full' => {
    const existing = find.get(visitorId, name) as CaughtEntry | undefined
    if (existing) return existing // catching twice keeps the original date, even when full
    if ((count.get(visitorId) as number) >= maxSize) return 'full'
    const caughtAt = now().toISOString()
    insert.run(visitorId, name, caughtAt)
    return { name, caughtAt }
  })

  return {
    /** Most recently caught first. */
    list: (visitorId: string) => all.all(visitorId) as CaughtEntry[],
    add: (visitorId: string, name: string) => add(visitorId, name),
    remove: (visitorId: string, name: string) => void remove.run(visitorId, name),
    reset: (visitorId: string) => void reset.run(visitorId),
    close: () => db.close(),
  }
}

export type CollectionStore = ReturnType<typeof createCollectionStore>
