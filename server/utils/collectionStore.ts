import type { Database } from 'better-sqlite3'

export interface CollectionStore {
  list(visitorId: string): string[]
  add(visitorId: string, name: string): void
  remove(visitorId: string, name: string): void
  reset(visitorId: string): void
  close(): void
}

/** All SQL for the collection lives here. Every query is scoped by visitor_id. */
export function createCollectionStore(db: Database): CollectionStore {
  db.exec(`
    CREATE TABLE IF NOT EXISTS collection (
      visitor_id TEXT NOT NULL,
      name TEXT NOT NULL,
      caught_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (visitor_id, name)
    )
  `)

  const listStmt = db.prepare('SELECT name FROM collection WHERE visitor_id = ? ORDER BY caught_at, name')
  const addStmt = db.prepare('INSERT OR IGNORE INTO collection (visitor_id, name) VALUES (?, ?)')
  const removeStmt = db.prepare('DELETE FROM collection WHERE visitor_id = ? AND name = ?')
  const resetStmt = db.prepare('DELETE FROM collection WHERE visitor_id = ?')

  return {
    list: visitorId => (listStmt.all(visitorId) as { name: string }[]).map(r => r.name),
    add: (visitorId, name) => void addStmt.run(visitorId, name),
    remove: (visitorId, name) => void removeStmt.run(visitorId, name),
    reset: visitorId => void resetStmt.run(visitorId),
    close: () => void db.close()
  }
}
