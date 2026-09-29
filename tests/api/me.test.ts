import { describe, expect, it } from 'vitest'
import { VISITOR_COOKIE } from '../../server/utils/visitor'
import { baseUrl, visitor } from './helpers'

describe('GET /api/me', () => {
  it('returns a label made of the first four characters of the visitor ID', async () => {
    const v = visitor()
    const { status, body } = await v.json<{ label: string }>('/api/me')
    expect(status).toBe(200)
    expect(body.label).toBe(`Trainer #${v.id!.slice(0, 4)}`)
  })

  it('returns the same label for the same cookie', async () => {
    const v = visitor()
    const first = await v.json<{ label: string }>('/api/me')
    const second = await v.json<{ label: string }>('/api/me')
    expect(second.body.label).toBe(first.body.label)
  })

  it('returns different labels for different browsers', async () => {
    const [a, b] = [visitor(), visitor()]
    const [ra, rb] = await Promise.all([a.json<{ label: string }>('/api/me'), b.json<{ label: string }>('/api/me')])
    expect(a.id).not.toBe(b.id)
    expect(ra.body.label).toBe(`Trainer #${a.id!.slice(0, 4)}`)
    expect(rb.body.label).toBe(`Trainer #${b.id!.slice(0, 4)}`)
  })

  it('lower-cases an upper-case UUID from the cookie', async () => {
    const id = '0A1B2C3D-0000-4000-8000-000000000000'
    const res = await fetch(`${baseUrl()}/api/me`, { headers: { cookie: `${VISITOR_COOKIE}=${id}` } })
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(await res.json()).toEqual({ label: 'Trainer #0a1b' })
  })
})
