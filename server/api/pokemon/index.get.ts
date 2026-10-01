const DEFAULT_LIMIT = 24
const MAX_LIMIT = 100

/**
 * A query parameter as a string: the first value if it is repeated, '' if it is
 * missing.
 */
const first = (value: unknown) =>
  String(Array.isArray(value) ? value[0] : (value ?? ''))

/**
 * A whole-number query parameter clamped to [min, max], or `fallback` when
 * missing or not a whole number.
 */
function intParam(value: unknown, fallback: number, min: number, max: number) {
  const raw = first(value)
  const n = raw === '' ? Number.NaN : Number(raw)

  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback
}

/** The names this visitor has caught, for the "Caught only" filter. */
const caughtNames = (visitorId: string) =>
  new Set(
    useCollectionStore()
      .list(visitorId)
      .map(entry => entry.name),
  )

export default defineEventHandler(event => {
  const query = getQuery(event)

  // "Caught only" is the one variant of this list that depends on who asks.
  const caught = first(query.caught).trim().toLowerCase() === 'true'
  if (caught) markPrivate(event)
  const only = caught ? caughtNames(requireVisitorId(event)) : undefined

  return queryPokemon({
    q: first(query.q),
    type: first(query.type).trim().toLowerCase() || undefined,
    only,
    limit: intParam(query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT),
    offset: intParam(query.offset, 0, 0, Number.MAX_SAFE_INTEGER),
  })
})
