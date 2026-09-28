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
    // Secure only in production over https, so `npm run preview` on http://localhost still works.
    secure: process.env.NODE_ENV === 'production' && getRequestProtocol(event, { xForwardedProto: true }) === 'https'
  })
  event.context.visitorId = visitorId

  // Server-side sub-requests made while rendering this page (useRequestFetch) forward the
  // request's cookie header. Put the new ID there so they see the same visitor as the browser
  // will on its next request, instead of each minting a different one.
  const others = (event.node.req.headers.cookie ?? '')
    .split(';')
    .map(c => c.trim())
    .filter(c => c && !c.startsWith(`${VISITOR_COOKIE}=`))
  event.node.req.headers.cookie = [...others, `${VISITOR_COOKIE}=${visitorId}`].join('; ')
})
