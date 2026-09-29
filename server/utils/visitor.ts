import type { H3Event } from 'h3'

export const VISITOR_COOKIE = 'pokeworld_visitor'

export function requireVisitorId(event: H3Event): string {
  return event.context.visitorId
}

export const visitorLabel = (id: string) => `Trainer #${id.slice(0, 4)}`
