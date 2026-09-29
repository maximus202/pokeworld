import { VISITOR_COOKIE } from './visitorIdentity'

/** Longest file extension we treat as a file request (favicon.ico, robots.txt, ...). */
const MAX_EXTENSION_LENGTH = 8
const FILE_EXTENSION = new RegExp(`\\.[a-z0-9]{1,${MAX_EXTENSION_LENGTH}}$`, 'i')
const NON_VISITOR_PREFIXES = /^\/(_nuxt\/|__nuxt|\.well-known\/)/

/**
 * Whether a request should be identified as a visitor. Pages and every /api route are; build
 * assets, Nuxt-internal routes, /.well-known and other file-like paths are not, so probes and
 * bots do not mint visitors or make those responses carry a cookie.
 */
export function isVisitorTraffic(path: string): boolean {
  const pathname = path.split('?')[0] ?? path
  if (pathname.startsWith('/api/')) return true
  if (NON_VISITOR_PREFIXES.test(pathname)) return false
  return !FILE_EXTENSION.test(pathname)
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
