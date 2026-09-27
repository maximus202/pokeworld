import { createServer, type Server } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = dirname(fileURLToPath(import.meta.url))
const read = (file: string) => readFileSync(join(dir, file), 'utf8')

export interface FixtureServer {
  url: string
  port: number
  /** Number of requests seen per path (e.g. "/pokemon/bulbasaur"). */
  counts: Map<string, number>
  count(path: string): number
  resetCounts(): void
  close(): Promise<void>
}

/** A tiny stand-in for PokeAPI that serves recorded JSON and counts requests. */
export async function startFixtureServer(port = 0): Promise<FixtureServer> {
  const counts = new Map<string, number>()

  const server: Server = createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://fixture')
    counts.set(pathname, (counts.get(pathname) ?? 0) + 1)

    let body: string | undefined
    if (pathname === '/pokemon') body = read('pokemon-index.json')
    else if (pathname === '/type/grass') body = read('type-grass.json')
    else {
      const match = pathname.match(/^\/pokemon\/([a-z0-9-]+)$/)
      const file = match && `pokemon/${match[1]}.json`
      if (file && existsSync(join(dir, file))) body = read(file)
    }

    if (body === undefined) {
      res.writeHead(404, { 'content-type': 'application/json' })
      res.end('{"detail":"Not found."}')
      return
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(body)
  })

  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve))
  const actualPort = (server.address() as { port: number }).port

  return {
    url: `http://127.0.0.1:${actualPort}`,
    port: actualPort,
    counts,
    count: path => counts.get(path) ?? 0,
    resetCounts: () => counts.clear(),
    close: () => new Promise<void>((resolve, reject) => server.close(err => (err ? reject(err) : resolve())))
  }
}
