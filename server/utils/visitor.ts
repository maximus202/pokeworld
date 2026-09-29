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

/** The calling visitor's ID. Throws if the visitor middleware did not run for this request. */
export function requireVisitorId(event: H3Event): string {
  const id = event.context.visitorId
  if (!id) {
    throw createError({ statusCode: 500, statusMessage: 'Visitor middleware did not run' })
  }
  return id
}

export const visitorLabel = (id: string) => `Trainer #${id.slice(0, 4)}`

/**
 * Whether a request should be identified as a visitor. Pages and every /api route are; build
 * assets, Nuxt-internal routes, /.well-known and other file-like paths (favicon.ico,
 * robots.txt, ...) are not, so probes and bots do not mint visitors or make those responses
 * carry a cookie.
 */
export function isVisitorTraffic(path: string): boolean {
  const pathname = path.split('?')[0] ?? path
  if (pathname.startsWith('/api/')) return true
  if (/^\/(_nuxt\/|__nuxt|\.well-known\/)/.test(pathname)) return false
  return !/\.[a-z0-9]{1,8}$/i.test(pathname)
}

/**
 * The cookie header to forward to server-side sub-requests: the incoming cookies, minus any
 * existing (empty or malformed) visitor cookie, plus the visitor cookie for `id`.
 */
export function withVisitorCookie(header: string | undefined, id: string): string {
  const others = (header ?? '')
    .split(';')
    .map(c => c.trim())
    .filter(c => c && !c.startsWith(`${VISITOR_COOKIE}=`))
  return [...others, `${VISITOR_COOKIE}=${id}`].join('; ')
}

/**
 * True when the browser reached us over https. Behind a proxy that is the first value of
 * X-Forwarded-Proto (chained proxies send "https,http"); otherwise it is the connection itself.
 */
export function isHttpsRequest(forwardedProto: string | undefined, connectionEncrypted: boolean): boolean {
  const first = forwardedProto?.split(',')[0]?.trim().toLowerCase()
  return first ? first === 'https' : connectionEncrypted
}
