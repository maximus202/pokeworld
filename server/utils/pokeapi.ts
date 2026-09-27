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

function upstream<T>(path: string): Promise<T> {
  const { pokeapiBaseUrl } = useRuntimeConfig()
  return $fetch(`${pokeapiBaseUrl}${path}`) as Promise<T>
}

function idFromUrl(url: string): number {
  return Number(url.replace(/\/+$/, '').split('/').pop())
}

/** Every Pokemon name and id, in PokeAPI order. One upstream request. */
export function getPokemonIndex(): Promise<PokemonIndexEntry[]> {
  return cached('index', async () => {
    const data = await upstream<{ results: { name: string, url: string }[] }>('/pokemon?limit=100000')
    return data.results.map(r => ({ id: idFromUrl(r.url), name: r.name }))
  })
}

/** Names of every Pokemon with grass in any type slot. One upstream request. */
export function getGrassNames(): Promise<Set<string>> {
  return cached('type:grass', async () => {
    const data = await upstream<{ pokemon: { pokemon: { name: string } }[] }>('/type/grass')
    return new Set(data.pokemon.map(p => p.pokemon.name))
  })
}

/** PokeAPI details for one Pokemon; throws a 404 H3 error when it does not exist. */
export function getPokemon(name: string): Promise<PokeApiPokemon> {
  return cached(`pokemon:${name}`, async () => {
    try {
      return await upstream<PokeApiPokemon>(`/pokemon/${encodeURIComponent(name)}`)
    } catch (error) {
      if ((error as { statusCode?: number }).statusCode === 404) {
        throw createError({ statusCode: 404, statusMessage: 'Pokemon not found' })
      }
      throw createError({ statusCode: 502, statusMessage: 'PokeAPI request failed' })
    }
  })
}

const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'

/** List images are derived from the id so a page of Pokemon needs no per-item request. */
export function listImageUrl(id: number, shiny: boolean): string {
  return shiny ? `${SPRITES}/shiny/${id}.png` : `${SPRITES}/${id}.png`
}
