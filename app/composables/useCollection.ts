import type { CollectionItem, CollectionResponse } from '#shared/types/pokemon'

const MESSAGES: Record<number, string> = {
  404: 'That Pokemon could not be found.',
  409: 'Your collection is full. Remove a Pokemon to make room.',
}

/**
 * The visitor's caught Pokemon, shared across the app. Load it on the server (`refresh`) so the
 * header count is right on first paint; every change re-reads it, so the client never drifts.
 */
export function useCollection() {
  const items = useState<CollectionItem[]>('collection-items', () => [])
  const latestRead = useState('collection-latest-read', () => 0) // per request on the server, unlike a module variable
  const requestFetch = useRequestFetch()
  const toast = useToast()

  async function refresh() {
    const mine = ++latestRead.value
    let read: CollectionResponse
    try {
      read = await requestFetch<CollectionResponse>('/api/collection')
    }
    catch (error) {
      if (mine === latestRead.value) throw error
      return // a newer read has started: this one is stale, and so is its failure
    }
    if (mine === latestRead.value) items.value = read.items
  }

  /** Re-reads after a change that already succeeded, so a failed read is not reported as a failed change. */
  const refreshAfterChange = () => refresh().catch(() =>
    toast.add({ title: 'Couldn\'t refresh your collection', description: 'Reload the page to see the latest.', color: 'error' }))

  /** Runs a change, then re-reads the collection. A failure is shown as a toast and returns false. */
  async function change(request: () => Promise<unknown>, title: string) {
    try {
      await request()
    }
    catch (error) {
      const description = MESSAGES[(error as { statusCode?: number }).statusCode ?? 0] ?? 'Something went wrong. Please try again.'
      toast.add({ title, description, color: 'error' })
      return false
    }
    await refreshAfterChange()
    return true
  }

  return {
    items,
    count: computed(() => items.value.length),
    refresh,
    has: (name: string) => items.value.some(item => item.name === name),
    /** When it was caught (ISO 8601 UTC), or undefined if it is not in the collection. */
    caughtAt: (name: string) => items.value.find(item => item.name === name)?.caughtAt,
    catchPokemon: (name: string) => change(() => $fetch(`/api/collection/${name}`, { method: 'PUT' }), 'Couldn\'t catch that Pokemon'),
    removePokemon: (name: string) => change(() => $fetch(`/api/collection/${name}`, { method: 'DELETE' }), 'Couldn\'t remove that Pokemon'),
    /** Throws if the reset itself fails, so the reset dialog can show the error. */
    async reset() {
      await $fetch('/api/collection', { method: 'DELETE' })
      await refreshAfterChange()
    },
  }
}
