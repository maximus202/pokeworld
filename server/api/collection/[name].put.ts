export default defineEventHandler(async event => {
  const name = requireName(event)

  // Only real Pokemon can be caught: the name has to be in the cached list.
  await assertPokedexName(name)

  const entry = useCollectionStore().add(requireVisitorId(event), name)
  if (entry === 'full') {
    throw createError({ statusCode: 409, statusMessage: 'Collection is full' })
  }

  return entry
})
