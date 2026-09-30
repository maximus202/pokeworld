import type { CollectionItem, PokemonDetails, PokemonListItem, PokemonListResponse } from '#shared/types/pokemon'
import type { CaughtEntry } from './collectionStore'
import { mapLimit } from './mapLimit'
import { getPokemon, getPokemonIndex, getTypeMembers, getTypeNames, type PokedexEntry } from './pokeapi'

const ARTWORK_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork'

/**
 * List items are built from the index alone, so a page needs no request per Pokemon. This means
 * `shiny` follows the grass rule without checking that a shiny image exists; the details route
 * can differ for a grass Pokemon with none, and the browser falls back to the default image.
 */
export function toListItem({ id, name }: PokedexEntry, grass: Set<string>): PokemonListItem {
  const shiny = grass.has(name)
  return { id, name, shiny, imageUrl: `${ARTWORK_URL}/${shiny ? 'shiny/' : ''}${id}.png` }
}

/** At most this many PokeAPI lookups in flight while resolving a collection on a cold cache. */
const LOOKUP_CONCURRENCY = 8

/**
 * A caught Pokemon as a list item, from its details. If the details cannot be loaded the entry
 * keeps its place with `pokemon: null`, so the count is right and the UI can offer a retry.
 */
export function toCollectionItems(entries: CaughtEntry[], lookup: (name: string) => Promise<PokemonDetails> = getPokemon): Promise<CollectionItem[]> {
  return mapLimit(entries, LOOKUP_CONCURRENCY, async ({ name, caughtAt }) => ({
    name,
    caughtAt,
    pokemon: await lookup(name).then(({ id, image }): PokemonListItem => ({ id, name, shiny: image.shiny, imageUrl: image.url }), (error: Error & { statusMessage?: string }) => {
      console.warn(`[collection] could not load ${name}: ${error.statusMessage ?? error.message}`)
      return null
    }),
  }))
}

export interface PokemonQuery {
  q: string
  type?: string
  /** Only these names, for the "Caught only" filter. */
  only?: Set<string>
  limit: number
  offset: number
}

/** One page of Pokemon matching the name search and type filter, in Pokedex order. */
export async function queryPokemon({ q, type, only, limit, offset }: PokemonQuery): Promise<PokemonListResponse> {
  if (type && !(await getTypeNames()).includes(type)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown type' })
  }
  const [index, grass, inType] = await Promise.all([
    getPokemonIndex(),
    getTypeMembers('grass'),
    type ? getTypeMembers(type) : undefined,
  ])
  // The search text is matched against the name as it is shown ("mr mime", not "mr-mime"), so what
  // the visitor types is what they see on the card.
  const needle = q.trim().toLowerCase()
  const matches = index.filter(entry => displayName(entry.name).toLowerCase().includes(needle) && (!inType || inType.has(entry.name)) && (!only || only.has(entry.name)))
  return { total: matches.length, items: matches.slice(offset, offset + limit).map(entry => toListItem(entry, grass)) }
}
