export default defineEventHandler(async (event) => {
  const name = requireName(event)
  await assertPokedexName(name) // only real Pokemon can be caught: the name has to be in the cached list
  const entry = useCollectionStore().add(requireVisitorId(event), name)
  if (entry === 'full') throw createError({ statusCode: 409, statusMessage: 'Collection is full' })
  return entry
})
