import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { createCollectionStore } from '../../server/utils/collectionStore'

const dirs: string[] = []
const open: { close(): void }[] = []
afterEach(() => {
  open.splice(0).forEach(s => s.close())
  dirs.splice(0).forEach(d => rmSync(d, { recursive: true, force: true }))
})

/** A store on an in-memory database whose clock ticks one minute per call. */
function storeWithClock(maxSize = 1000) {
  let minute = 0
  const store = createCollectionStore(new Database(':memory:'), {
    maxSize,
    now: () => new Date(Date.UTC(2026, 8, 28, 14, minute++, 0, 402)),
  })
  open.push(store)
  return store
}

describe('collection store', () => {
  it('stamps each catch with an ISO 8601 UTC time from the injected clock', () => {
    const store = storeWithClock()
    expect(store.add('a', 'bulbasaur')).toEqual({ name: 'bulbasaur', caughtAt: '2026-09-28T14:00:00.402Z' })
  })

  it('lists the most recently caught first', () => {
    const store = storeWithClock()
    for (const name of ['bulbasaur', 'lotad', 'charmander']) store.add('a', name)
    expect(store.list('a').map(e => e.name)).toEqual(['charmander', 'lotad', 'bulbasaur'])
  })

  it('breaks a tie on caught time by name', () => {
    const store = createCollectionStore(new Database(':memory:'), { maxSize: 10, now: () => new Date(0) })
    open.push(store)
    for (const name of ['lotad', 'bulbasaur']) store.add('a', name)
    expect(store.list('a').map(e => e.name)).toEqual(['bulbasaur', 'lotad'])
  })

  it('keeps the original date when a Pokemon is caught again', () => {
    const store = storeWithClock()
    const first = store.add('a', 'bulbasaur')
    expect(store.add('a', 'bulbasaur')).toEqual(first)
    expect(store.list('a')).toEqual([first])
  })

  it('refuses a new catch past the cap, but still accepts a Pokemon already caught', () => {
    const store = storeWithClock(2)
    store.add('a', 'bulbasaur')
    store.add('a', 'lotad')
    expect(store.add('a', 'charmander')).toBe('full')
    expect(store.add('a', 'lotad')).toMatchObject({ name: 'lotad' })
    expect(store.list('a')).toHaveLength(2)
  })

  it('counts the cap per visitor', () => {
    const store = storeWithClock(1)
    store.add('a', 'bulbasaur')
    expect(store.add('b', 'bulbasaur')).toMatchObject({ name: 'bulbasaur' })
  })

  it('removes one Pokemon for one visitor only, and removing it twice is a no-op', () => {
    const store = storeWithClock()
    store.add('a', 'bulbasaur')
    store.add('b', 'bulbasaur')
    store.remove('a', 'bulbasaur')
    store.remove('a', 'bulbasaur')
    expect(store.list('a')).toEqual([])
    expect(store.list('b')).toHaveLength(1)
  })

  it('resets one visitor only', () => {
    const store = storeWithClock()
    store.add('a', 'bulbasaur')
    store.add('b', 'lotad')
    store.reset('a')
    expect(store.list('a')).toEqual([])
    expect(store.list('b').map(e => e.name)).toEqual(['lotad'])
  })

  it('keeps a collection, including its dates, after the database is closed and reopened', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pokeworld-'))
    dirs.push(dir)
    const file = join(dir, 'pokeworld.db')
    const first = createCollectionStore(new Database(file), { maxSize: 10, now: () => new Date('2026-09-28T14:03:11.402Z') })
    first.add('a', 'bulbasaur')
    first.close()

    const second = createCollectionStore(new Database(file), { maxSize: 10 })
    open.push(second)
    expect(second.list('a')).toEqual([{ name: 'bulbasaur', caughtAt: '2026-09-28T14:03:11.402Z' }])
  })
})

describe('the collection size cap', () => {
  it.each([Number.NaN, 0, -1, 1.5, Number.POSITIVE_INFINITY])('refuses %s, instead of silently removing the cap', (maxSize) => {
    const db = new Database(':memory:')
    expect(() => createCollectionStore(db, { maxSize })).toThrowError(/maxSize/)
    db.close()
  })

  it('accepts a whole number of at least 1', () => {
    const store = createCollectionStore(new Database(':memory:'), { maxSize: 1 })
    open.push(store)
    expect(store.add('a', 'bulbasaur')).toMatchObject({ name: 'bulbasaur' })
    expect(store.add('a', 'lotad')).toBe('full')
  })
})
