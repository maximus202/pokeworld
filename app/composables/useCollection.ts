import type { CollectionItem, CollectionResponse } from '#shared/types/pokemon'

function failureMessage(error: unknown): string {
  const status = (error as { statusCode?: number }).statusCode
  if (status === 409) return 'Your collection is full. Remove a Pokemon to make room.'
  if (status === 404) return 'That Pokemon could not be found.'
  return 'Something went wrong. Please try again.'
}

/**
 * The current visitor's caught Pokemon, shared across the app. It is loaded on the server for the
 * first render (so the header count is right immediately) and refreshed after every change.
 */
export function useCollection() {
  const items = useState<CollectionItem[]>('collection-items', () => [])
  const loaded = useState('collection-loaded', () => false)
  const failed = useState('collection-failed', () => false)
  const requestFetch = useRequestFetch()
  const toast = useToast()

  const count = computed(() => items.value.length)

  async function refresh() {
    try {
      const data = await requestFetch<CollectionResponse>('/api/collection')
      items.value = data.items
      failed.value = false
    } catch {
      failed.value = true
    } finally {
      loaded.value = true
    }
  }

  function has(name: string) {
    return items.value.some(i => i.name === name)
  }

  /** When the Pokemon was caught (ISO 8601 UTC), or undefined if it is not in the collection. */
  function caughtAt(name: string) {
    return items.value.find(i => i.name === name)?.caughtAt
  }

  async function mutate(request: () => Promise<unknown>, title: string): Promise<boolean> {
    try {
      await request()
    } catch (error) {
      toast.add({ title, description: failureMessage(error), color: 'error' })
      return false
    }
    await refresh()
    return true
  }

  const catchPokemon = (name: string) =>
    mutate(() => $fetch(`/api/collection/${name}`, { method: 'PUT' }), 'Couldn\'t catch that Pokemon')

  const removePokemon = (name: string) =>
    mutate(() => $fetch(`/api/collection/${name}`, { method: 'DELETE' }), 'Couldn\'t remove that Pokemon')

  /** Throws on failure so the reset dialog can show the error itself. */
  async function reset() {
    await $fetch('/api/collection', { method: 'DELETE' })
    await refresh()
  }

  return { items, count, loaded, failed, has, caughtAt, refresh, catchPokemon, removePokemon, reset }
}
