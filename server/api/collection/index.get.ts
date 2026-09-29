import type { CollectionResponse } from '#shared/types/pokemon'

export default defineEventHandler(async (event): Promise<CollectionResponse> => {
  const entries = useCollectionStore().list(requireVisitorId(event))
  return { count: entries.length, items: await toCollectionItems(entries) }
})
