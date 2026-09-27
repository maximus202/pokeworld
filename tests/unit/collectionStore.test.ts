import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { createCollectionStore } from '../../server/utils/collectionStore'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('collection store', () => {
  it('scopes every operation to the visitor', () => {
    const store = createCollectionStore(new Database(':memory:'))
    store.add('a', 'bulbasaur')
    store.add('b', 'charmander')

    expect(store.list('a')).toEqual(['bulbasaur'])
    expect(store.list('b')).toEqual(['charmander'])

    store.remove('b', 'bulbasaur') // not B's row
    store.reset('b')
    expect(store.list('a')).toEqual(['bulbasaur'])
    expect(store.list('b')).toEqual([])
  })

  it('treats duplicate adds and missing removes as no-ops', () => {
    const store = createCollectionStore(new Database(':memory:'))
    store.add('a', 'bulbasaur')
    store.add('a', 'bulbasaur')
    store.remove('a', 'missingno')
    expect(store.list('a')).toEqual(['bulbasaur'])
  })

  it('does not treat SQL in a name as SQL', () => {
    const store = createCollectionStore(new Database(':memory:'))
    store.add('a', "x'); DROP TABLE collection;--")
    expect(store.list('a')).toEqual(["x'); DROP TABLE collection;--"])
  })

  it('persists across closing and reopening the same database file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pokeworld-'))
    dirs.push(dir)
    const file = join(dir, 'test.db')

    const first = createCollectionStore(new Database(file))
    first.add('a', 'bulbasaur')
    first.close()

    const second = createCollectionStore(new Database(file))
    expect(second.list('a')).toEqual(['bulbasaur'])
    second.close()
  })
})
