/** The details panel is driven by `?pokemon=name`, so closing it returns to the same screen. */
export function usePokemonPanel() {
  const route = useRoute()
  const router = useRouter()

  const selected = computed(() => {
    const value = route.query.pokemon
    return typeof value === 'string' && value ? value : null
  })

  function to(name: string | null) {
    const { pokemon: _omit, ...rest } = route.query
    return { query: name ? { ...rest, pokemon: name } : rest }
  }

  function close() {
    return router.push(to(null))
  }

  return { selected, to, close }
}
