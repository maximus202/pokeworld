import type { LocationQueryRaw } from 'vue-router'

interface Filters {
  q: string
  type: string
  caught: boolean
}

const sameFilters = (a: Filters, b: Filters) =>
  a.q === b.q && a.type === b.type && a.caught === b.caught

/**
 * The browse screen's search, type filter and "Caught only" toggle. They live
 * in the URL (`?q=&type=&caught=true`), which is the single source of truth, so
 * a filtered view survives a reload and a link to the plain screen clears them.
 * Changes replace the history entry.
 */
export function useBrowseFilters() {
  const route = useRoute()
  const router = useRouter()
  const text = (value: unknown) => (typeof value === 'string' ? value : '')

  // Keeps the same object while the values are unchanged. Otherwise opening the
  // details panel (which only adds `?pokemon=`) would look like a filter change
  // and reload the list from page one.
  const filters = computed<Filters>(previous => {
    const next = {
      q: text(route.query.q).trim(),
      type: text(route.query.type),
      caught: route.query.caught === 'true',
    }

    return previous && sameFilters(previous, next) ? previous : next
  })

  /** Sets query parameters; an empty value removes the parameter. */
  function update(patch: { q?: string; type?: string; caught?: string }) {
    const query: LocationQueryRaw = { ...route.query, ...patch }

    for (const key of Object.keys(query)) {
      if (!query[key]) delete query[key]
    }

    return router.replace({ query })
  }

  return {
    filters,
    update,
    clear: () => update({ q: '', type: '', caught: '' }),
  }
}
