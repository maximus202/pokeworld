export default defineEventHandler((event) => {
  useCollectionStore().remove(requireVisitorId(event), requireName(event))
  return sendNoContent(event)
})
