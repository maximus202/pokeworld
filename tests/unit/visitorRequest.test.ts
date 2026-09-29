import { describe, expect, it } from 'vitest'
import { isHttpsRequest, isVisitorTraffic, withVisitorCookie } from '../../server/utils/visitorRequest'

describe('isVisitorTraffic', () => {
  it.each([
    '/',
    '/collection',
    '/?pokemon=bulbasaur',
    '/api/me',
    '/api/collection/mr-mime',
    '/api/collection/odd.name', // dots never make an /api route skip the middleware
  ])('identifies %s', (path) => {
    expect(isVisitorTraffic(path)).toBe(true)
  })

  it.each([
    '/_nuxt/entry.abc123.js',
    '/__nuxt_error',
    '/__nuxt_island/x.json',
    '/favicon.ico',
    '/robots.txt',
    '/apple-touch-icon.png',
    '/.well-known/security.txt',
    '/favicon.ico?v=2',
  ])('does not identify %s', (path) => {
    expect(isVisitorTraffic(path)).toBe(false)
  })

  it('still identifies a future page whose path starts with a single underscore', () => {
    expect(isVisitorTraffic('/_drafts')).toBe(true)
  })
})

describe('withVisitorCookie', () => {
  const ID = '0a1b2c3d-0000-4000-8000-000000000000'

  it('adds the visitor cookie when there are no cookies', () => {
    expect(withVisitorCookie(undefined, ID)).toBe(`pokeworld_visitor=${ID}`)
  })

  it('keeps unrelated cookies and appends the visitor cookie', () => {
    expect(withVisitorCookie('theme=dark; lang=en', ID)).toBe(`theme=dark; lang=en; pokeworld_visitor=${ID}`)
  })

  it.each(['pokeworld_visitor=', 'pokeworld_visitor=abc'])('drops %s but keeps the other cookies', (bad) => {
    expect(withVisitorCookie(`theme=dark; ${bad}; lang=en`, ID)).toBe(`theme=dark; lang=en; pokeworld_visitor=${ID}`)
  })

  it('does not treat a cookie that merely starts with the same letters as the visitor cookie', () => {
    expect(withVisitorCookie('pokeworld_visitor_x=1', ID)).toBe(`pokeworld_visitor_x=1; pokeworld_visitor=${ID}`)
  })
})

describe('isHttpsRequest', () => {
  it('uses the connection when there is no forwarded header', () => {
    expect(isHttpsRequest(undefined, true)).toBe(true)
    expect(isHttpsRequest(undefined, false)).toBe(false)
  })

  it('trusts the first value of X-Forwarded-Proto', () => {
    expect(isHttpsRequest('https', false)).toBe(true)
    expect(isHttpsRequest('https,http', false)).toBe(true)
    expect(isHttpsRequest(' HTTPS , http', false)).toBe(true)
    expect(isHttpsRequest('http,https', true)).toBe(false)
    expect(isHttpsRequest('http', true)).toBe(false)
  })
})
