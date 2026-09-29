import { describe, expect, it } from 'vitest'
import { baseUrl, cookieIn, visitor } from './helpers'

const labelIn = (html: string) => html.match(/data-testid="visitor-label"[^>]*>([^<]*)</)?.[1]

describe('first-visit SSR cookie (spike)', () => {
  it('renders the same visitor the response sets as a cookie', async () => {
    const res = await fetch(baseUrl(), { redirect: 'manual' })
    const id = cookieIn(res)
    expect(id).toBeTruthy()
    expect(labelIn(await res.text())).toBe(`Trainer #${id!.slice(0, 4)}`)
  })

  it('uses the cookie a returning visitor already has', async () => {
    const v = visitor()
    await v.request('/api/me') // gets a cookie
    const res = await v.request('/')
    expect(cookieIn(res)).toBeUndefined()
    expect(labelIn(await res.text())).toBe(`Trainer #${v.id!.slice(0, 4)}`)
  })

  it.each([['empty', ''], ['malformed', 'abc']])(
    'renders the replacement visitor when the incoming cookie is %s',
    async (_name, value) => {
      const res = await fetch(baseUrl(), {
        headers: { cookie: `pokeworld_visitor=${value}` },
        redirect: 'manual',
      })
      const id = cookieIn(res)
      expect(id).toBeTruthy()
      expect(labelIn(await res.text())).toBe(`Trainer #${id!.slice(0, 4)}`)
    },
  )
})
