/**
 * Identifies the browser as a "visitor". The cookie is an identifier, not a credential.
 * No visitor row is created here; a row is written only when the visitor catches something.
 */
export default defineEventHandler((event) => {
  if (!isVisitorTraffic(event.path)) return
  event.context.visitorId = resolveVisitorId(event)
})
