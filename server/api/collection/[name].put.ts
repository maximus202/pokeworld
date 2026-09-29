export default defineEventHandler(async (event) => {
  const name = requireName(event)
  await getPokemon(name) // only real Pokemon can be caught; this also warms the cache for the next render
  const entry = useCollectionStore().add(requireVisitorId(event), name)
  if (entry === 'full') throw createError({ statusCode: 409, statusMessage: 'Collection is full' })
  return entry
})
