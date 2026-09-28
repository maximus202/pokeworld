export default defineEventHandler(async (event) => {
  const name = requireName(getRouterParam(event, 'name'))
  // Only real Pokemon can be caught. This is cached, so it also warms the details lookup.
  await getPokemon(name)

  const result = useCollectionStore().add(requireVisitorId(event), name)
  if (result === 'full') {
    throw createError({ statusCode: 409, statusMessage: 'Your collection is full' })
  }
  return result
})
