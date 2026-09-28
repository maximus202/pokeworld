import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { createCollectionStore } from '../../server/utils/collectionStore'

/** A clock that returns each of the given instants in turn. */
function clock(...times: string[]) {
  let i = 0
  return () => new Date(times[Math.min(i++, times.length - 1)]!)
}

describe('collection store', () => {
  it('records the catch time as an ISO 8601 UTC string from the injected clock', () => {
    const store = createCollectionStore(new Database(':memory:'), { now: clock('2026-09-28T14:03:11.402Z') })
    expect(store.add('a', 'bulbasaur')).toEqual({ name: 'bulbasaur', caughtAt: '2026-09-28T14:03:11.402Z' })
    expect(store.list('a')).toEqual([{ name: 'bulbasaur', caughtAt: '2026-09-28T14:03:11.402Z' }])
  })

  it('lists the most recently caught first', () => {
    const store = createCollectionStore(new Database(':memory:'), {
      now: clock('2026-09-01T00:00:00.000Z', '2026-09-03T00:00:00.000Z', '2026-09-02T00:00:00.000Z')
    })
    store.add('a', 'first')
    store.add('a', 'third')
    store.add('a', 'second')
    expect(store.list('a').map(e => e.name)).toEqual(['third', 'second', 'first'])
  })

  it('orders catches made at the same instant by insertion, newest first', () => {
    const store = createCollectionStore(new Database(':memory:'), { now: clock('2026-09-01T00:00:00.000Z') })
    store.add('a', 'one')
    store.add('a', 'two')
    expect(store.list('a').map(e => e.name)).toEqual(['two', 'one'])
  })

  it('is idempotent: catching again returns the original entry and keeps its date', () => {
    const store = createCollectionStore(new Database(':memory:'), {
      now: clock('2026-09-01T00:00:00.000Z', '2026-09-09T00:00:00.000Z')
    })
    store.add('a', 'bulbasaur')
    expect(store.add('a', 'bulbasaur')).toEqual({ name: 'bulbasaur', caughtAt: '2026-09-01T00:00:00.000Z' })
    expect(store.list('a')).toHaveLength(1)
  })

  it('caps a visitor at maxSize, but still accepts an already-caught Pokemon when full', () => {
    const store = createCollectionStore(new Database(':memory:'), { maxSize: 2 })
    store.add('a', 'one')
    store.add('a', 'two')
    expect(store.add('a', 'three')).toBe('full')
    expect(store.list('a')).toHaveLength(2)
    expect(store.add('a', 'two')).toMatchObject({ name: 'two' })
    store.remove('a', 'one')
    expect(store.add('a', 'three')).toMatchObject({ name: 'three' })
  })

  it('applies the cap per visitor', () => {
    const store = createCollectionStore(new Database(':memory:'), { maxSize: 1 })
    store.add('a', 'one')
    expect(store.add('b', 'one')).toMatchObject({ name: 'one' })
  })

  it('keeps visitors separate for list, remove and reset', () => {
    const store = createCollectionStore(new Database(':memory:'))
    store.add('a', 'bulbasaur')
    store.add('b', 'charmander')
    expect(store.list('a').map(e => e.name)).toEqual(['bulbasaur'])
    expect(store.list('b').map(e => e.name)).toEqual(['charmander'])

    store.remove('b', 'bulbasaur')
    expect(store.list('a')).toHaveLength(1)

    store.reset('b')
    expect(store.list('b')).toEqual([])
    expect(store.list('a')).toHaveLength(1)
  })

  it('remove and reset are no-ops when there is nothing to remove', () => {
    const store = createCollectionStore(new Database(':memory:'))
    expect(() => store.remove('a', 'missing')).not.toThrow()
    expect(() => store.reset('a')).not.toThrow()
  })

  describe('persistence', () => {
    let dir = ''
    afterEach(() => rmSync(dir, { recursive: true, force: true }))

    it('survives closing and reopening the same database file, including the date', () => {
      dir = mkdtempSync(join(tmpdir(), 'pokeworld-'))
      const file = join(dir, 'test.db')

      const first = createCollectionStore(new Database(file), { now: clock('2026-09-28T14:03:11.402Z') })
      first.add('a', 'bulbasaur')
      first.close()

      const second = createCollectionStore(new Database(file))
      expect(second.list('a')).toEqual([{ name: 'bulbasaur', caughtAt: '2026-09-28T14:03:11.402Z' }])
      second.close()
    })
  })
})
