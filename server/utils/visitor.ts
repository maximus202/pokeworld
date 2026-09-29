import { createError, type H3Event } from 'h3'

declare module 'h3' {
  interface H3EventContext {
    /** Set by server/middleware/visitor.ts on every request. */
    visitorId?: string
  }
}

export const VISITOR_COOKIE = 'pokeworld_visitor'

/** The calling visitor's ID. Throws if the visitor middleware has not run. */
export function requireVisitorId(event: H3Event): string {
  const id = event.context.visitorId
  if (!id) {
    throw createError({ statusCode: 500, statusMessage: 'Visitor middleware did not run' })
  }
  return id
}

export const visitorLabel = (id: string) => `Trainer #${id.slice(0, 4)}`
