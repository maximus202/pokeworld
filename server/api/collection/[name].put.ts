export default defineEventHandler((event) => {
  const name = requireName(getRouterParam(event, 'name'))
  useCollectionStore().add(requireVisitorId(event), name)
  setResponseStatus(event, 204)
  return null
})
