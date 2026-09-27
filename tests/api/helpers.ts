import { url } from '@nuxt/test-utils/e2e'

/** A fake browser with its own cookie jar, so tests can act as separate visitors. */
export async function newVisitor() {
  let cookie = ''

  async function call(path: string, init: RequestInit = {}) {
    const res = await fetch(url(path), { ...init, headers: { ...init.headers, ...(cookie ? { cookie } : {}) } })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie) cookie = setCookie.split(';')[0]!
    return res
  }

  await call('/api/me') // first contact issues the cookie
  return {
    call,
    get cookie() {
      return cookie
    },
    json: async <T = unknown>(path: string, init?: RequestInit) => (await call(path, init)).json() as Promise<T>
  }
}
