import { randomUUID } from 'node:crypto'

export const VISITOR_COOKIE = 'pokeworld_visitor'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ONE_YEAR = 60 * 60 * 24 * 365

/**
 * Identifies the browser as a "visitor". The cookie is an identifier, not a credential.
 * Missing or malformed values are replaced with a fresh UUID.
 */
export default defineEventHandler((event) => {
  if (event.path.startsWith('/_')) return

  const existing = getCookie(event, VISITOR_COOKIE)
  if (existing && UUID.test(existing)) {
    event.context.visitorId = existing.toLowerCase()
    return
  }

  const visitorId = randomUUID()
  setCookie(event, VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: ONE_YEAR,
    path: '/',
    secure: process.env.NODE_ENV === 'production'
  })
  event.context.visitorId = visitorId
})
