import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import type { CollectionItem } from '#shared/types/pokemon'

const item = (name: string, caughtAt: string): CollectionItem => ({
  name,
  caughtAt,
  pokemon: { id: 1, name, shiny: false, imageUrl: null },
})

// The fake server: a collection, plus a switch to make changes fail.
let server: CollectionItem[] = []
let failWith: number | undefined
const calls: string[] = []

const respond = (event: { method: string, path: string }, change?: () => void) => {
  calls.push(`${event.method} ${event.path}`)
  if (failWith) throw createError({ statusCode: failWith })
  change?.()
  return null
}
registerEndpoint('/api/collection', {
  method: 'GET',
  handler: () => ({ count: server.length, items: server }),
})
registerEndpoint('/api/collection', {
  method: 'DELETE',
  handler: event => respond(event, () => (server = [])),
})
registerEndpoint('/api/collection/bulbasaur', {
  method: 'PUT',
  handler: event => respond(event, () => server.unshift(item('bulbasaur', '2026-09-28T14:00:00.000Z'))),
})
registerEndpoint('/api/collection/bulbasaur', {
  method: 'DELETE',
  handler: event => respond(event, () => (server = server.filter(i => i.name !== 'bulbasaur'))),
})

beforeEach(() => {
  useState('collection-items').value = [] // not clearNuxtState: earlier tests' headers still read it
  server = [item('lotad', '2026-09-27T10:00:00.000Z')]
  failWith = undefined
  calls.length = 0
})

describe('useCollection', () => {
  it('loads the collection, then answers count, has and caughtAt from it', async () => {
    const collection = useCollection()
    expect(collection.count.value).toBe(0)

    await collection.refresh()

    expect(collection.count.value).toBe(1)
    expect(collection.has('lotad')).toBe(true)
    expect(collection.has('bulbasaur')).toBe(false)
    expect(collection.caughtAt('lotad')).toBe('2026-09-27T10:00:00.000Z')
    expect(collection.caughtAt('bulbasaur')).toBeUndefined()
  })

  it('catches a Pokemon, then re-reads the collection so the client matches the server', async () => {
    const collection = useCollection()
    await collection.refresh()

    expect(await collection.catchPokemon('bulbasaur')).toBe(true)

    expect(calls).toEqual([expect.stringMatching(/^PUT .*\/api\/collection\/bulbasaur$/)])
    expect(collection.has('bulbasaur')).toBe(true)
    expect(collection.caughtAt('bulbasaur')).toBe('2026-09-28T14:00:00.000Z')
  })

  it('removes a Pokemon, then re-reads the collection', async () => {
    server = [item('bulbasaur', '2026-09-28T14:00:00.000Z')]
    const collection = useCollection()
    await collection.refresh()

    expect(await collection.removePokemon('bulbasaur')).toBe(true)

    expect(collection.has('bulbasaur')).toBe(false)
    expect(collection.count.value).toBe(0)
  })

  it.each([409, 500])('shows a toast and leaves the collection unchanged when a catch fails with %s', async (status) => {
    const collection = useCollection()
    const toast = useToast()
    await collection.refresh()
    failWith = status

    expect(await collection.catchPokemon('bulbasaur')).toBe(false)

    expect(collection.has('bulbasaur')).toBe(false)
    expect(collection.count.value).toBe(1)
    expect(toast.toasts.value.at(-1)).toMatchObject({
      title: 'Couldn\'t catch that Pokemon',
      description: status === 409 ? expect.stringContaining('full') : expect.stringContaining('Something went wrong'),
    })
  })

  it('resets the collection', async () => {
    const collection = useCollection()
    await collection.refresh()
    await collection.reset()
    expect(collection.count.value).toBe(0)
  })

  it('throws from reset when it fails, and leaves the collection unchanged', async () => {
    const collection = useCollection()
    await collection.refresh()
    failWith = 500

    await expect(collection.reset()).rejects.toThrow()
    expect(collection.count.value).toBe(1)
  })
})
