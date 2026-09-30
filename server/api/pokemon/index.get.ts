const DEFAULT_LIMIT = 24
const MAX_LIMIT = 100

/** A query parameter as a string: the first value if it is repeated, '' if it is missing. */
const first = (value: unknown) => String(Array.isArray(value) ? value[0] : (value ?? ''))

/** A whole-number query parameter clamped to [min, max], or `fallback` when missing or not a whole number. */
function intParam(value: unknown, fallback: number, min: number, max: number) {
  const raw = first(value)
  const n = raw === '' ? Number.NaN : Number(raw)
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const caught = first(query.caught).trim().toLowerCase() === 'true'
  if (caught) markPrivate(event) // only this variant depends on who is asking
  return queryPokemon({
    q: first(query.q),
    type: first(query.type).trim().toLowerCase() || undefined,
    only: caught ? new Set(useCollectionStore().list(requireVisitorId(event)).map(e => e.name)) : undefined,
    limit: intParam(query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT),
    offset: intParam(query.offset, 0, 0, Number.MAX_SAFE_INTEGER),
  })
})
