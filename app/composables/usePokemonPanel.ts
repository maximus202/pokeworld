/**
 * The details panel is driven by `?pokemon=name`, so closing it returns to the same screen, and a
 * link can be shared or reloaded. Other query parameters (search, filters) are kept.
 */
export function usePokemonPanel() {
  const route = useRoute()
  const router = useRouter()

  const selected = computed(() => (typeof route.query.pokemon === 'string' && route.query.pokemon) || null)

  /** A link to the current screen with this Pokemon open (or, with null, closed). */
  function to(name: string | null) {
    const { pokemon: _open, ...rest } = route.query
    return { query: name ? { ...rest, pokemon: name } : rest }
  }

  return { selected, to, close: () => router.replace(to(null)) }
}
