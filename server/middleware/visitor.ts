// Spike (phase 1): issues the visitor cookie and shares it with server-side sub-requests made
// while rendering the same page. Phase 2 hardens this (malformed values, Secure, asset paths).
export default defineEventHandler((event) => {
  let id = getCookie(event, VISITOR_COOKIE)
  if (!id) {
    id = crypto.randomUUID()
    setCookie(event, VISITOR_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
    })
    // A first-time visitor has no cookie on the incoming request, so sub-requests made with
    // useRequestFetch() would each mint a different visitor. Put the new ID on the request.
    const existing = event.node.req.headers.cookie
    event.node.req.headers.cookie = `${existing ? `${existing}; ` : ''}${VISITOR_COOKIE}=${id}`
  }
  event.context.visitorId = id
})
