import { createError, getRouterParam, type H3Event } from 'h3'

const NAME = /^[a-z0-9-]{1,100}$/

/**
 * The `:name` route parameter, lower-cased. Anything that cannot be a Pokemon
 * name is a 400.
 */
export function requireName(event: H3Event): string {
  const name = getRouterParam(event, 'name')?.toLowerCase() ?? ''

  if (!NAME.test(name)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid name' })
  }

  return name
}
