import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openCollectionStore } from '../../server/utils/useCollectionStore'

const dirs: string[] = []
const open: { close(): void }[] = []
afterEach(() => {
  open.splice(0).forEach(s => s.close())
  dirs.splice(0).forEach(d => rmSync(d, { recursive: true, force: true }))
})
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'pokeworld-'))
  dirs.push(dir)
  return dir
}

describe('openCollectionStore', () => {
  it.each([Number.NaN, 0, 1.5])('checks the cap %s before opening anything, so a bad value leaks no database handle', (maxSize) => {
    const file = join(tempDir(), 'data', 'pokeworld.db')

    expect(() => openCollectionStore(file, maxSize)).toThrowError(/maxSize/)

    expect(existsSync(file)).toBe(false) // never opened
    expect(existsSync(join(file, '..'))).toBe(false) // nor was the folder made
  })

  it('creates the folder and the database file, and returns a working store', () => {
    const file = join(tempDir(), 'data', 'pokeworld.db')

    const store = openCollectionStore(file, 10)
    open.push(store)

    expect(existsSync(file)).toBe(true)
    expect(store.add('a', 'bulbasaur')).toMatchObject({ name: 'bulbasaur' })
  })

  it('works in memory', () => {
    const store = openCollectionStore(':memory:', 10)
    open.push(store)
    expect(store.list('a')).toEqual([])
  })
})
