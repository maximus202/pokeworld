import { createServer, type Server } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AddressInfo } from 'node:net'

const dir = dirname(fileURLToPath(import.meta.url))
const DEFAULT_PAGE_SIZE = 5

export interface FixtureServer {
  url: string
  close(): Promise<void>
}

/** Maps a PokeAPI path (no query string) to a fixture file, or undefined when there is none. */
function fileFor(path: string): string | undefined {
  let rel: string | undefined
  if (path === '/pokemon') rel = 'pokemon-index.json'
  else if (path === '/type') rel = 'type-index.json'
  else if (/^\/pokemon\/[a-z0-9-]+$/.test(path)) rel = `pokemon/${path.split('/')[2]}.json`
  else if (/^\/type\/[a-z0-9-]+$/.test(path)) rel = `type/${path.split('/')[2]}.json`
  const file = rel && join(dir, rel)
  return file && existsSync(file) ? file : undefined
}

/**
 * A stand-in for PokeAPI that serves the recorded fixtures. It counts requests per path and can
 * be told over HTTP to fail, so tests in other processes (the built app, Playwright) control it:
 *
 *   POST /__control/reset                 clear counts and failures
 *   POST /__control/fail?path=/pokemon/x  the next request for that path returns 500
 *   POST /__control/fail?path=/x&mode=garbage  ...or a 200 whose body is not the expected shape
 *   GET  /__control/counts                { "/pokemon/bulbasaur": 1, ... }
 */
export async function startFixtureServer(port = 0): Promise<FixtureServer> {
  const counts: Record<string, number> = {}
  const failNext = new Map<string, 'error' | 'garbage'>()

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const send = (status: number, body: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(body))
    }

    if (url.pathname.startsWith('/__control/')) {
      const action = url.pathname.slice('/__control/'.length)
      if (action === 'reset') {
        for (const k of Object.keys(counts)) delete counts[k]
        failNext.clear()
      } else if (action === 'fail') {
        failNext.set(url.searchParams.get('path') ?? '', url.searchParams.get('mode') === 'garbage' ? 'garbage' : 'error')
      } else if (action === 'counts') {
        return send(200, counts)
      }
      return send(200, { ok: true })
    }

    counts[url.pathname] = (counts[url.pathname] ?? 0) + 1
    const queued = failNext.get(url.pathname)
    failNext.delete(url.pathname)
    if (queued === 'error') return send(500, { error: 'fixture failure' })
    if (queued === 'garbage') return send(200, { unexpected: true })

    const file = fileFor(url.pathname)
    if (!file) return send(404, { error: 'not found' })
    const body = JSON.parse(readFileSync(file, 'utf8'))
    // Like PokeAPI, list endpoints return only a small first page unless the caller sets `limit`.
    // The page is kept smaller than the fixtures so a request that forgets `limit` is caught.
    if (Array.isArray(body.results)) body.results = body.results.slice(0, Number(url.searchParams.get('limit') ?? DEFAULT_PAGE_SIZE))
    send(200, body)
  })

  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve))
  const address = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise(resolve => server.close(() => resolve()))
  }
}

/** Client for the control endpoints above. */
export function fixtureControl(url: string) {
  const post = (path: string) => fetch(`${url}/__control/${path}`, { method: 'POST' })
  return {
    reset: () => post('reset'),
    failNext: (path: string, mode: 'error' | 'garbage' = 'error') => post(`fail?path=${encodeURIComponent(path)}&mode=${mode}`),
    counts: async (): Promise<Record<string, number>> => (await fetch(`${url}/__control/counts`)).json()
  }
}
