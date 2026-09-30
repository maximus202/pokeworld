import { getCookie, getRequestHeader, setCookie, type H3Event } from 'h3'
import { VISITOR_COOKIE, VISITOR_ID_PATTERN } from './visitorIdentity'
import { markPrivate } from './markPrivate'
import { isHttpsRequest, withVisitorCookie } from './visitorRequest'

const ONE_YEAR = 60 * 60 * 24 * 365

/** The visitor ID in the request's cookie, if it is a valid one. */
function existingVisitorId(event: H3Event): string | undefined {
  const value = getCookie(event, VISITOR_COOKIE)
  return value && VISITOR_ID_PATTERN.test(value)
    ? value.toLowerCase()
    : undefined
}

/**
 * Gives the browser a new visitor ID and makes it visible to this request's
 * sub-requests.
 */
function issueVisitorId(event: H3Event): string {
  const id = crypto.randomUUID()

  // This response carries a Set-Cookie: a shared cache must not hand it to
  // another visitor.
  markPrivate(event)

  const https = isHttpsRequest(
    getRequestHeader(event, 'x-forwarded-proto'),
    Boolean((event.node.req.socket as { encrypted?: boolean }).encrypted),
  )
  setCookie(event, VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: ONE_YEAR,
    path: '/',
    // Secure only in production over https, so `npm run preview` on
    // http://localhost still works.
    secure: process.env.NODE_ENV === 'production' && https,
  })

  // Server-side sub-requests made while rendering this page (useFetch ->
  // useRequestFetch) forward the incoming request's cookie header. For a
  // first-time visitor it has no cookie, so each sub-request would mint a
  // different visitor. Put the new ID there instead. This reaches into the Node
  // request object, which is fine for the node-server preset the app deploys
  // with. It would need another route on an edge runtime, where event.node is
  // absent.
  event.node.req.headers.cookie = withVisitorCookie(
    event.node.req.headers.cookie,
    id,
  )

  return id
}

/**
 * The visitor's ID: the one in their cookie, or a newly issued one if it is
 * missing or malformed.
 */
export function resolveVisitorId(event: H3Event): string {
  return existingVisitorId(event) ?? issueVisitorId(event)
}
