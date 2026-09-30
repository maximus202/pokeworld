import { describe, expect, it } from 'vitest'
import { VISITOR_COOKIE } from '../../server/utils/visitorIdentity'
import { baseUrl, visitor } from './helpers'

describe('GET /api/me', () => {
  it('returns a label made of the first four characters of the visitor ID', async () => {
    const v = visitor()
    const { status, body } = await v.json<{ label: string }>('/api/me')
    expect(status).toBe(200)
    expect(body.label).toBe(`Trainer #${v.id!.slice(0, 4)}`)
  })

  it('lower-cases an upper-case UUID from the cookie', async () => {
    const id = '0A1B2C3D-0000-4000-8000-000000000000'
    const res = await fetch(`${baseUrl()}/api/me`, { headers: { cookie: `${VISITOR_COOKIE}=${id}` } })
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(await res.json()).toEqual({ label: 'Trainer #0a1b' })
  })
})
