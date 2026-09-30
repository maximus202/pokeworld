import type { LocationQueryRaw } from 'vue-router'

/**
 * The browse screen's search, type filter and "Caught only" toggle. They live in the URL
 * (`?q=&type=&caught=true`), which is the single source of truth, so a filtered view survives a
 * reload and a link to the plain screen clears them. Changes replace the history entry.
 */
export function useBrowseFilters() {
  const route = useRoute()
  const router = useRouter()
  const text = (value: unknown) => (typeof value === 'string' ? value : '')

  const filters = computed(() => ({
    q: text(route.query.q).trim(),
    type: text(route.query.type),
    caught: route.query.caught === 'true',
  }))

  /** Sets query parameters; an empty value removes the parameter. */
  function update(patch: { q?: string, type?: string, caught?: string }) {
    const query: LocationQueryRaw = { ...route.query, ...patch }
    for (const key of Object.keys(query)) if (!query[key]) delete query[key]
    return router.replace({ query })
  }

  return { filters, update, clear: () => update({ q: '', type: '', caught: '' }) }
}
