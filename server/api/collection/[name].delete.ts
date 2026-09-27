export default defineEventHandler((event) => {
  const name = requireName(getRouterParam(event, 'name'))
  useCollectionStore().remove(requireVisitorId(event), name)
  setResponseStatus(event, 204)
  return null
})
