export default defineEventHandler(event => {
  useCollectionStore().reset(requireVisitorId(event))
  return sendNoContent(event)
})
