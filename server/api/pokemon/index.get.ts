const DEFAULT_LIMIT = 24
const MAX_LIMIT = 100

/** A whole-number query parameter clamped to [min, max], or `fallback` when missing or not a number. */
function intParam(value: unknown, fallback: number, min: number, max: number) {
  const n = Number.parseInt(String(value), 10)
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n))
}

export default defineEventHandler((event) => {
  const query = getQuery(event)
  return queryPokemon({
    q: String(query.q ?? ''),
    type: query.type ? String(query.type) : undefined,
    limit: intParam(query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT),
    offset: intParam(query.offset, 0, 0, Number.MAX_SAFE_INTEGER),
  })
})
