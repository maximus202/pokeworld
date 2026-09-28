import { inject } from 'vitest'
import { fixtureControl } from '../fixtures/server'

export const baseUrl = () => inject('baseUrl')
export const fixture = () => fixtureControl(inject('fixtureUrl'))
export const collectionCap = () => inject('collectionCap')

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
      if (id) headers.set('cookie', `pokeworld_visitor=${id}`)
      const res = await fetch(`${baseUrl()}${path}`, { ...init, headers, redirect: 'manual' })
      const match = res.headers.get('set-cookie')?.match(/pokeworld_visitor=([^;]+)/)
      if (match) id = match[1]
      return res
    },
    async json(path, init) {
      const res = await v.request(path, init)
      const text = await res.text()
      return { status: res.status, body: (text ? JSON.parse(text) : null) as never }
    }
  }
  return v
}

export const put = (v: Visitor, name: string) => v.json<{ name: string, caughtAt: string }>(`/api/collection/${name}`, { method: 'PUT' })
export const del = (v: Visitor, name: string) => v.json(`/api/collection/${name}`, { method: 'DELETE' })
