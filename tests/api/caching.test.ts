import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { $fetch, setup } from '@nuxt/test-utils/e2e'
import { startFixtureServer } from '../fixtures/server'

const fixture = await startFixtureServer()
afterAll(() => fixture.close())

await setup({
  rootDir: fileURLToPath(new URL('../..', import.meta.url)),
  server: true,
  nuxtConfig: { runtimeConfig: { pokeapiBaseUrl: fixture.url, dbPath: ':memory:' } }
})

describe('PokeAPI caching', () => {
  it('hits the upstream once for repeated detail requests', async () => {
    await $fetch('/api/pokemon/charmander')
    await $fetch('/api/pokemon/charmander')
    await $fetch('/api/pokemon/charmander')
    expect(fixture.count('/pokemon/charmander')).toBe(1)
  })

  it('hits the upstream once for repeated list and search calls', async () => {
    await $fetch('/api/pokemon')
    await $fetch('/api/pokemon?q=bulb')
    await $fetch('/api/pokemon?limit=2&offset=2')
    expect(fixture.count('/pokemon')).toBe(1)
    expect(fixture.count('/type/grass')).toBe(1)
  })

  it('does not cache failures', async () => {
    const { url } = await import('@nuxt/test-utils/e2e')
    await fetch(url('/api/pokemon/nope'))
    await fetch(url('/api/pokemon/nope'))
    expect(fixture.count('/pokemon/nope')).toBe(2)
  })
})
