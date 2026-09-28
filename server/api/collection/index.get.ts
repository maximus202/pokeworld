import type { CollectionItem, CollectionResponse } from '#shared/types/pokemon'

const UPSTREAM_CONCURRENCY = 8

/**
 * The visitor's caught Pokemon, joined with what the grid needs to show them. A Pokemon whose
 * details cannot be loaded stays in the response with `pokemon: null` (so `count` always matches
 * the items) and the UI can offer a retry instead of silently dropping it.
 */
export default defineEventHandler(async (event): Promise<CollectionResponse> => {
  const entries = useCollectionStore().list(requireVisitorId(event))
  const grass = await getGrassNames().catch(() => undefined)

  // A cold cache after a restart would otherwise fetch every caught Pokemon at once.
  const items: CollectionItem[] = await mapLimit(entries, UPSTREAM_CONCURRENCY, async ({ name, caughtAt }) => {
    try {
      const pokemon = await getPokemon(name)
      const shiny = grass ? grass.has(pokemon.name) : isGrass(pokemon)
      return { name, caughtAt, pokemon: { id: pokemon.id, name: pokemon.name, imageUrl: listImageUrl(pokemon.id, shiny), shiny } }
    } catch {
      return { name, caughtAt, pokemon: null }
    }
  })

  return { count: items.length, items }
})
