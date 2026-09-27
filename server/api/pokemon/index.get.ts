export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = String(query.q ?? '').trim().toLowerCase()
  const limit = Math.min(Math.max(Number.parseInt(String(query.limit ?? '24'), 10) || 24, 1), 100)
  const offset = Math.max(Number.parseInt(String(query.offset ?? '0'), 10) || 0, 0)

  const [index, grass] = await Promise.all([getPokemonIndex(), getGrassNames()])
  const matches = q ? index.filter(p => p.name.includes(q)) : index

  return {
    total: matches.length,
    items: matches.slice(offset, offset + limit).map((p) => {
      const shiny = grass.has(p.name)
      return { id: p.id, name: p.name, imageUrl: listImageUrl(p.id, shiny), shiny }
    })
  }
})
