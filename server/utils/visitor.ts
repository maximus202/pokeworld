import type { H3Event } from 'h3'

export function requireVisitorId(event: H3Event): string {
  const id = event.context.visitorId as string | undefined
  if (!id) {
    throw createError({ statusCode: 500, statusMessage: 'Visitor not identified' })
  }
  return id
}
