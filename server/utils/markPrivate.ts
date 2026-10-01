import { setResponseHeader, type H3Event } from 'h3'

/**
 * For a response that depends on the visitor's cookie: no shared cache (CDN,
 * proxy, routeRules) may store it and hand it to someone else, and the browser
 * must not reuse a stale copy either.
 */
export const markPrivate = (event: H3Event) =>
  setResponseHeader(event, 'cache-control', 'private, no-store')
