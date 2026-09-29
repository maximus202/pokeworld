const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ONE_YEAR = 60 * 60 * 24 * 365

/**
 * Identifies the browser as a "visitor". The cookie is an identifier, not a credential.
 * A missing or malformed value (empty, not a UUID) is replaced with a fresh UUID. No visitor
 * row is created here; a row is written only when the visitor catches something.
 */
export default defineEventHandler((event) => {
  // Nuxt-internal routes (/__nuxt_error, /__nuxt_island, ...) are not visitor traffic.
  if (event.path.startsWith('/_')) return

  const existing = getCookie(event, VISITOR_COOKIE)
  if (existing && UUID.test(existing)) {
    event.context.visitorId = existing.toLowerCase()
    return
  }

  const visitorId = crypto.randomUUID()
  setCookie(event, VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: ONE_YEAR,
    path: '/',
    // Secure only in production over https, so `npm run preview` on http://localhost still works.
    secure: process.env.NODE_ENV === 'production'
      && getRequestProtocol(event, { xForwardedProto: true }) === 'https',
  })
  event.context.visitorId = visitorId

  // Server-side sub-requests made while rendering this page (useFetch -> useRequestFetch)
  // forward the incoming request's cookie header. For a first-time visitor it has no cookie,
  // so each sub-request would mint a different visitor. Put the new ID there instead.
  // This reaches into the Node request object, which is fine for the node-server preset the
  // app deploys with. It would need another route on an edge runtime, where event.node is absent.
  const others = (event.node.req.headers.cookie ?? '')
    .split(';')
    .map(c => c.trim())
    .filter(c => c && !c.startsWith(`${VISITOR_COOKIE}=`))
  event.node.req.headers.cookie = [...others, `${VISITOR_COOKIE}=${visitorId}`].join('; ')
})
