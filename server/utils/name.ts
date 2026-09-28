const NAME = /^[a-z0-9-]{1,100}$/

/** Lower-cases and validates a Pokemon or type name from the URL; anything else is a 400. */
export function requireName(value: string | undefined): string {
  const name = (value ?? '').trim().toLowerCase()
  if (!NAME.test(name)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid name' })
  }
  return name
}
