import { createError } from 'h3'
import type { PokemonDetails } from '#shared/types/pokemon'
import { pickImage, type PokeApiImageSource } from './pickImage'

const TIMEOUT_MS = 10_000

/**
 * PokeAPI numbers alternate forms (megas, regional variants) from 10001; only
 * Pokedex entries are browsable.
 */
const MAX_POKEDEX_ID = 10_000

/** Types with no Pokemon to browse. */
const HIDDEN_TYPES = new Set(['unknown', 'shadow', 'stellar'])

export interface PokedexEntry {
  id: number
  name: string
}

type PokeApiPokemon = PokeApiImageSource & {
  id: number
  name: string
  height: number
  abilities: { ability: { name: string } }[]
}

const cache = new Map<string, Promise<unknown>>()

/**
 * Fetches `path` once, with a timeout, and reduces the response with `project`.
 * Any failure, including a body that is not the shape `project` expects,
 * becomes a clean 502 (an upstream 404 stays 404).
 */
async function fetchProjected<Raw, T>(
  path: string,
  project: (raw: Raw) => T,
): Promise<T> {
  try {
    const raw = await $fetch<Raw>(path, {
      baseURL: useRuntimeConfig().pokeapiBaseUrl,
      timeout: TIMEOUT_MS,
      retry: 0,
    })

    return project(raw as Raw)
  } catch (error) {
    const notFound = (error as { statusCode?: number }).statusCode === 404

    throw createError({
      statusCode: notFound ? 404 : 502,
      statusMessage: notFound ? 'Not found' : 'PokeAPI request failed',
    })
  }
}

/**
 * Memoises `fetchProjected` for the life of the process. Only the projection is
 * kept, so a large upstream record costs a few fields. A failure is not cached,
 * so the next call retries.
 */
function load<Raw, T>(path: string, project: (raw: Raw) => T): Promise<T> {
  const cached = cache.get(path) as Promise<T> | undefined
  if (cached) return cached

  const request = fetchProjected(path, project).catch(error => {
    cache.delete(path)
    throw error
  })
  cache.set(path, request)

  return request
}

// What we keep from each PokeAPI response.

const toIndex = ({ results }: { results: { name: string; url: string }[] }) =>
  results
    .map(
      ({ name, url }): PokedexEntry => ({
        name,
        id: Number(url.split('/').at(-2)),
      }),
    )
    .filter(entry => entry.id < MAX_POKEDEX_ID)

const toTypeNames = ({ results }: { results: { name: string }[] }) =>
  results.map(t => t.name).filter(name => !HIDDEN_TYPES.has(name))

const toMemberSet = ({
  pokemon,
}: {
  pokemon: { pokemon: { name: string } }[]
}) => new Set(pokemon.map(p => p.pokemon.name))

const toDetails = (pokemon: PokeApiPokemon): PokemonDetails => ({
  id: pokemon.id,
  name: pokemon.name,
  height: pokemon.height,
  abilities: pokemon.abilities.map(a => a.ability.name),
  types: pokemon.types.map(t => t.type.name),
  image: pickImage(pokemon),
})

// What we ask PokeAPI for.

/** Every Pokedex entry in Pokedex order. */
export const getPokemonIndex = (): Promise<PokedexEntry[]> =>
  load('/pokemon?limit=100000', toIndex)

export const getTypeNames = (): Promise<string[]> =>
  load('/type?limit=100', toTypeNames)

/** Names of every Pokemon with this type in any slot. */
export const getTypeMembers = (type: string): Promise<Set<string>> =>
  load(`/type/${type}`, toMemberSet)

/**
 * A name that is not a Pokedex entry is a 404, decided from the cached list
 * without asking PokeAPI about it.
 */
export async function assertPokedexName(name: string): Promise<void> {
  if (!(await getPokemonIndex()).some(entry => entry.name === name)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }
}

/** A Pokemon's details. */
export async function getPokemon(name: string): Promise<PokemonDetails> {
  await assertPokedexName(name)

  return load(`/pokemon/${name}`, toDetails)
}
