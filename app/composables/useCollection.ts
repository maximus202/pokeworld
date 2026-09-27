/**
 * The current visitor's caught Pokemon. Fetched client-side only: the visitor cookie is
 * set on the first document response, so SSR sub-requests would not carry it yet.
 */
export function useCollection() {
  const names = useState<string[]>('collection', () => [])
  const loaded = useState('collection-loaded', () => false)

  async function refresh() {
    names.value = await $fetch<string[]>('/api/collection')
    loaded.value = true
  }

  function has(name: string) {
    return names.value.includes(name)
  }

  async function catchPokemon(name: string) {
    await $fetch(`/api/collection/${name}`, { method: 'PUT' })
    if (!has(name)) names.value = [...names.value, name]
  }

  async function removePokemon(name: string) {
    await $fetch(`/api/collection/${name}`, { method: 'DELETE' })
    names.value = names.value.filter(n => n !== name)
  }

  async function reset() {
    await $fetch('/api/collection', { method: 'DELETE' })
    names.value = []
  }

  return { names, loaded, has, refresh, catchPokemon, removePokemon, reset }
}
