const NAME_PATTERN = /^[a-z0-9-]{1,100}$/

/** Lower-cases and validates a Pokemon name; returns null when invalid. */
export function normalizeName(raw: string | undefined): string | null {
  const name = (raw ?? '').toLowerCase()
  return NAME_PATTERN.test(name) ? name : null
}

export function requireName(raw: string | undefined): string {
  const name = normalizeName(raw)
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid Pokemon name' })
  }
  return name
}
