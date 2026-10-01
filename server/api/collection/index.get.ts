import type { CollectionResponse } from '#shared/types/pokemon'

export default defineEventHandler(async event => {
  markPrivate(event)

  const entries = useCollectionStore().list(requireVisitorId(event))
  const items = await toCollectionItems(entries)

  return { count: entries.length, items } satisfies CollectionResponse
})
