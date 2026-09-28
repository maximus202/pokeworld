import type { PokemonList } from '#shared/types/pokemon'

function intParam(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isNaN(n) ? fallback : Math.min(Math.max(n, min), max)
}

export default defineEventHandler(async (event): Promise<PokemonList> => {
  const query = getQuery(event)
  const q = String(query.q ?? '').trim().toLowerCase()
  const caughtOnly = query.caught === 'true'
  const type = query.type ? requireName(String(query.type)) : ''
  const limit = intParam(query.limit, 24, 1, 100)
  const offset = intParam(query.offset, 0, 0, Number.MAX_SAFE_INTEGER)

  if (type && !(await getTypeNames()).includes(type)) {
    throw createError({ statusCode: 404, statusMessage: 'Unknown type' })
  }

  const [index, grass, typeMembers] = await Promise.all([
    getPokemonIndex(),
    getGrassNames(),
    type ? getTypeMembers(type) : undefined
  ])

  let matches = index
  if (q) matches = matches.filter(p => p.name.includes(q))
  if (typeMembers) matches = matches.filter(p => typeMembers.has(p.name))
  if (caughtOnly) {
    const caught = new Set(useCollectionStore().list(requireVisitorId(event)).map(e => e.name))
    matches = matches.filter(p => caught.has(p.name))
  }

  return {
    total: matches.length,
    items: matches.slice(offset, offset + limit).map((p) => {
      const shiny = grass.has(p.name)
      return { id: p.id, name: p.name, imageUrl: listImageUrl(p.id, shiny), shiny }
    })
  }
})
