import { inject } from 'vitest'
import { fixtureControl } from '../fixtures/server'
import { VISITOR_COOKIE } from '../../server/utils/visitorIdentity'

export const baseUrl = () => inject('baseUrl')
export const fixture = () => fixtureControl(inject('fixtureUrl'))
export const collectionCap = () => inject('collectionCap')

/** The visitor ID a response asks the browser to store, if any. */
export function cookieIn(res: Response): string | undefined {
  return res.headers.get('set-cookie')?.match(new RegExp(`${VISITOR_COOKIE}=([^;]+)`))?.[1]
}

export interface Visitor {
  /** The value of this visitor's cookie, once one has been issued. */
  readonly id: string | undefined
  request(path: string, init?: RequestInit): Promise<Response>
  json<T = unknown>(path: string, init?: RequestInit): Promise<{ status: number, body: T }>
}

/** A client with its own cookie jar: one browser. */
export function visitor(initialId?: string): Visitor {
  let id = initialId
  const v: Visitor = {
    get id() { return id },
    async request(path, init = {}) {
      const headers = new Headers(init.headers)
      if (id) headers.set('cookie', `${VISITOR_COOKIE}=${id}`)
      const res = await fetch(`${baseUrl()}${path}`, { ...init, headers, redirect: 'manual' })
      id = cookieIn(res) ?? id
      return res
    },
    async json(path, init) {
      const res = await v.request(path, init)
      const text = await res.text()
      return { status: res.status, body: (text ? JSON.parse(text) : null) as never }
    },
  }
  return v
}
