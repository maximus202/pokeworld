import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CollectionResponse } from '../../shared/types/pokemon'
import { createCollectionStore } from '../../server/utils/collectionStore'
import { startApp, type RunningApp } from './app'
import { fixture } from './helpers'
import { inject } from 'vitest'

// The realistic way a collection entry cannot be resolved: the server restarts (its in-memory
// PokeAPI cache is empty) while PokeAPI is unavailable. The collection is on disk, so it must
// still be listed, count correctly and carry its dates.
const VISITOR = '11111111-2222-4333-8444-555555555555'

describe('collection after a restart while PokeAPI is down', () => {
  let dir = ''
  let app: RunningApp

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'pokeworld-'))
    const dbPath = join(dir, 'restart.db')
    const seed = createCollectionStore(new Database(dbPath), {
      now: (() => { let n = 0; return () => new Date(Date.UTC(2026, 8, 1 + n++)) })()
    })
    seed.add(VISITOR, 'bulbasaur')
    seed.add(VISITOR, 'charmander')
    seed.close()

    await fixture().failAll()
    app = await startApp({ dbPath, pokeapiUrl: inject('fixtureUrl') })
  })

  afterAll(async () => {
    app?.stop()
    await fixture().reset()
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns every entry with pokemon: null, its date, and the right count', async () => {
    const res = await fetch(`${app.baseUrl}/api/collection`, { headers: { cookie: `pokeworld_visitor=${VISITOR}` } })
    const body = await res.json() as CollectionResponse
    expect(res.status).toBe(200)
    expect(body.count).toBe(2)
    expect(body.items).toEqual([
      { name: 'charmander', caughtAt: '2026-09-02T00:00:00.000Z', pokemon: null },
      { name: 'bulbasaur', caughtAt: '2026-09-01T00:00:00.000Z', pokemon: null }
    ])
  })

  it('resolves the entries once PokeAPI is back', async () => {
    await fixture().reset()
    const res = await fetch(`${app.baseUrl}/api/collection`, { headers: { cookie: `pokeworld_visitor=${VISITOR}` } })
    const body = await res.json() as CollectionResponse
    expect(body.items.map(i => i.pokemon?.name)).toEqual(['charmander', 'bulbasaur'])
  })
})
