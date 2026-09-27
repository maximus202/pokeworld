export default defineEventHandler((event) => {
  return useCollectionStore().list(requireVisitorId(event))
})
