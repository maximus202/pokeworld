import { createError, type H3Event } from 'h3'

declare module 'h3' {
  interface H3EventContext {
    /** Set by server/middleware/visitor.ts for visitor traffic (see isVisitorTraffic). */
    visitorId?: string
  }
}

export const VISITOR_COOKIE = 'pokeworld_visitor'

/** What the middleware accepts as a visitor ID. It only ever issues v4 UUIDs. */
export const VISITOR_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const LABEL_LENGTH = 4

/** The calling visitor's ID. Throws if the visitor middleware did not run for this request. */
export function requireVisitorId(event: H3Event): string {
  const id = event.context.visitorId
  if (!id) {
    throw createError({ statusCode: 500, statusMessage: 'Visitor middleware did not run' })
  }
  return id
}

/** A short, human-readable form of the ID, e.g. "Trainer #a3f9". */
export const visitorLabel = (id: string) => `Trainer #${id.slice(0, LABEL_LENGTH)}`
