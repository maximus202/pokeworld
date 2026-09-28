import type { PokeApiPokemonImageSource } from './pickImage'

export interface PokeApiPokemon extends PokeApiPokemonImageSource {
  id: number
  name: string
  height: number
  abilities: { ability: { name: string } }[]
}

export interface PokemonIndexEntry {
  id: number
  name: string
}

// PokeAPI data is effectively static, so responses are cached for the life of the process.
// The cache is unbounded (at most the index, the type lists and the Pokemon actually viewed).
// Only successful responses stay cached; failures are retried on the next call.
const cache = new Map<string, Promise<unknown>>()

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
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

/**
 * One upstream GET. A 404 from PokeAPI becomes a 404 for our caller; anything else that goes
 * wrong (5xx, timeout, network) becomes a 502, so routes always fail with a predictable error.
 */
async function upstream<T>(path: string): Promise<T> {
  const { pokeapiBaseUrl } = useRuntimeConfig()
  try {
    return await $fetch(`${pokeapiBaseUrl}${path}`, { retry: 0, timeout: 10_000 }) as T
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode === 404) {
      throw createError({ statusCode: 404, statusMessage: 'Not found' })
    }
    throw createError({ statusCode: 502, statusMessage: 'PokeAPI request failed' })
  }
}

function idFromUrl(url: string): number {
  return Number(url.replace(/\/+$/, '').split('/').pop())
}

/** Types that have no Pokemon to browse. */
const HIDDEN_TYPES = new Set(['unknown', 'shadow', 'stellar'])

/**
 * PokeAPI numbers alternate forms (mega evolutions, regional variants, ...) from 10001 upwards.
 * They are not separate Pokedex entries, so the app browses, searches and catches only the rest.
 */
const FIRST_ALTERNATE_FORM_ID = 10000

/** Every Pokedex Pokemon's name and id, in PokeAPI order. One upstream request. */
export function getPokemonIndex(): Promise<PokemonIndexEntry[]> {
  return cached('index', async () => {
    const data = await upstream<{ results: { name: string, url: string }[] }>('/pokemon?limit=100000')
    return data.results
      .map(r => ({ id: idFromUrl(r.url), name: r.name }))
      .filter(p => p.id < FIRST_ALTERNATE_FORM_ID)
  })
}

/** The names in the index, for a lookup that needs no upstream request once it is cached. */
function getPokemonNames(): Promise<Set<string>> {
  return cached('index-names', async () => new Set((await getPokemonIndex()).map(p => p.name)))
}

/** Names of the Pokemon types, for the filter control. */
export function getTypeNames(): Promise<string[]> {
  return cached('types', async () => {
    const data = await upstream<{ results: { name: string }[] }>('/type')
    return data.results.map(t => t.name).filter(name => !HIDDEN_TYPES.has(name))
  })
}

/** Names of every Pokemon with this type in any slot. One upstream request per type. */
export function getTypeMembers(type: string): Promise<Set<string>> {
  return cached(`type:${type}`, async () => {
    const data = await upstream<{ pokemon: { pokemon: { name: string } }[] }>(`/type/${encodeURIComponent(type)}`)
    return new Set(data.pokemon.map(p => p.pokemon.name))
  })
}

/** Names of every Pokemon with grass in any type slot. */
export const getGrassNames = () => getTypeMembers('grass')

/**
 * PokeAPI details for one Pokemon; a 404 H3 error when it does not exist. Unknown names are
 * rejected from the cached index, so a made-up name never costs an upstream request.
 */
export async function getPokemon(name: string): Promise<PokeApiPokemon> {
  if (!(await getPokemonNames()).has(name)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
  return cached(`pokemon:${name}`, () => upstream<PokeApiPokemon>(`/pokemon/${encodeURIComponent(name)}`))
}

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'

/** List images are derived from the id so a page of Pokemon needs no per-item request. */
export function listImageUrl(id: number, shiny: boolean): string {
  return shiny ? `${SPRITES}/shiny/${id}.png` : `${SPRITES}/${id}.png`
}
