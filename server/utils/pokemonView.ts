import type { CollectionItem, PokemonListItem, PokemonListResponse } from '#shared/types/pokemon'
// Relative, not `#shared/...`: that alias is not available when the plain unit tests load this file. (Type imports are erased, so they can use it.)
import { displayName } from '../../shared/utils/displayName'
import type { CaughtEntry } from './collectionStore'
import { getPokemonIndex, getTypeMembers, getTypeNames, type PokedexEntry } from './pokeapi'

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

/** The cached Pokemon list and the set of Grass Pokemon: everything a list item is built from. */
const getCatalogue = () => Promise.all([getPokemonIndex(), getTypeMembers('grass')])

/**
 * Caught Pokemon as list items, built from the cached list like the browse screen's, so reading a
 * collection costs two cached requests however many Pokemon are in it. A name that is not in the
 * list, or every name if the list cannot be loaded, keeps its place with `pokemon: null`, so the
 * count is right and the UI can offer a retry.
 */
export async function toCollectionItems(entries: CaughtEntry[], catalogue = getCatalogue): Promise<CollectionItem[]> {
  const [index, grass] = await catalogue().catch((error): [PokedexEntry[], Set<string>] => {
    const { statusMessage, message } = error as Error & { statusMessage?: string }
    console.warn(`[collection] could not load the Pokemon list: ${statusMessage ?? message}`)
    return [[], new Set()]
  })
  const byName = new Map(index.map(entry => [entry.name, entry]))
  return entries.map(({ name, caughtAt }) => {
    const entry = byName.get(name)
    return { name, caughtAt, pokemon: entry ? toListItem(entry, grass) : null }
  })
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
