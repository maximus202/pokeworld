/**
 * The details panel is driven by `?pokemon=name`, so closing it returns to the
 * same screen, and a link can be shared or reloaded. Other query parameters
 * (search, filters) are kept.
 */
export function usePokemonPanel() {
  const route = useRoute()
  const router = useRouter()

  const selected = computed(() => {
    const { pokemon } = route.query

    return (typeof pokemon === 'string' && pokemon) || null
  })

  /**
   * A link to the current screen with this Pokemon open (or, with null,
   * closed).
   */
  function to(name: string | null) {
    const { pokemon: _open, ...rest } = route.query

    return { query: name ? { ...rest, pokemon: name } : rest }
  }

  /**
   * Opening pushes a history entry (a link). If the visitor came from this same
   * screen, closing steps back so no extra entry is left behind; a shared or
   * reloaded link has nothing to go back to.
   */
  function close() {
    const target = to(null)
    const cameFromHere =
      router.options.history.state.back === router.resolve(target).fullPath

    return cameFromHere ? router.back() : router.replace(target)
  }

  return { selected, to, close }
}
