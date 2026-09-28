export default defineEventHandler((event) => {
  useCollectionStore().reset(requireVisitorId(event))
  setResponseStatus(event, 204)
  return null
})
