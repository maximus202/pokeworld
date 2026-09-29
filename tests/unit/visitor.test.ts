import { describe, expect, it } from 'vitest'
import type { H3Event } from 'h3'
import { requireVisitorId, visitorLabel } from '../../server/utils/visitor'

const eventWith = (context: Record<string, unknown>) => ({ context }) as unknown as H3Event

describe('requireVisitorId', () => {
  it('returns the ID the middleware set', () => {
    expect(requireVisitorId(eventWith({ visitorId: 'a3f9-1234' }))).toBe('a3f9-1234')
  })

  it('throws a 500 with a clear message when the middleware did not run', () => {
    expect(() => requireVisitorId(eventWith({}))).toThrowError(
      expect.objectContaining({ statusCode: 500, statusMessage: 'Visitor middleware did not run' }),
    )
  })
})

describe('visitorLabel', () => {
  it('uses the first four characters of the ID', () => {
    expect(visitorLabel('a3f9c2d1-0000')).toBe('Trainer #a3f9')
  })
})
