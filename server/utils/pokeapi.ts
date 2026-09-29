import { createError } from 'h3'
import type { PokeApiImageSource } from './pickImage'

const TIMEOUT_MS = 10_000
/** PokeAPI numbers alternate forms (megas, regional variants) from 10001; only Pokedex entries are browsable. */
const MAX_POKEDEX_ID = 10_000
/** Types with no Pokemon to browse. */
const HIDDEN_TYPES = new Set(['unknown', 'shadow', 'stellar'])

export interface PokedexEntry { id: number, name: string }
export interface PokeApiPokemon extends PokeApiImageSource {
  id: number
  name: string
  height: number
  abilities: { ability: { name: string } }[]
}

const cache = new Map<string, Promise<unknown>>()

/** Memoises for the life of the process. A failed load is dropped, so the next call retries. */
function memo<T>(key: string, load: () => Promise<T>): Promise<T> {
  let hit = cache.get(key) as Promise<T> | undefined
  if (!hit) {
    hit = load().catch((error) => {
      cache.delete(key)
      throw error
    })
    cache.set(key, hit)
  }
  return hit
}

/** One attempt with a timeout; every upstream failure becomes a clean 502 (an upstream 404 stays 404). */
const pokeApi = <T>(path: string): Promise<T> => memo(path, async (): Promise<T> => {
  try {
    return await $fetch<T>(path, { baseURL: useRuntimeConfig().pokeapiBaseUrl, timeout: TIMEOUT_MS, retry: 0 }) as T
  }
  catch (error) {
    const status = (error as { statusCode?: number }).statusCode === 404 ? 404 : 502
    throw createError({ statusCode: status, statusMessage: status === 404 ? 'Not found' : 'PokeAPI request failed' })
  }
})

/** Every Pokedex entry in Pokedex order. */
export const getPokemonIndex = (): Promise<PokedexEntry[]> => memo('index', async () => {
  const { results } = await pokeApi<{ results: { name: string, url: string }[] }>('/pokemon?limit=100000')
  return results
    .map(({ name, url }): PokedexEntry => ({ name, id: Number(url.split('/').at(-2)) }))
    .filter(entry => entry.id < MAX_POKEDEX_ID)
})

export const getTypeNames = (): Promise<string[]> => memo('types', async () => {
  const { results } = await pokeApi<{ results: { name: string }[] }>('/type')
  return results.map(t => t.name).filter(name => !HIDDEN_TYPES.has(name))
})

/** Names of every Pokemon with this type in any slot. */
export const getTypeMembers = (type: string): Promise<Set<string>> => memo(`type:${type}`, async () => {
  const { pokemon } = await pokeApi<{ pokemon: { pokemon: { name: string } }[] }>(`/type/${type}`)
  return new Set(pokemon.map(p => p.pokemon.name))
})

/** A Pokemon's full record. A name that is not a Pokedex entry is a 404 without asking PokeAPI. */
export async function getPokemon(name: string): Promise<PokeApiPokemon> {
  if (!(await getPokemonIndex()).some(entry => entry.name === name)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  return pokeApi<PokeApiPokemon>(`/pokemon/${name}`)
}
