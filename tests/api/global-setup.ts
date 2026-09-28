import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import type { TestProject } from 'vitest/node'
import { startFixtureServer } from '../fixtures/server'

/** The collection cap the API tests run with, small enough to hit with the fixture Pokemon. */
export const TEST_COLLECTION_CAP = 4

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer()
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number }
      s.close(() => resolve(port))
    })
    s.on('error', reject)
  })
}

async function waitFor(url: string, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await fetch(url)
      return
    } catch {
      await new Promise(r => setTimeout(r, 200))
    }
  }
  throw new Error(`Timed out waiting for ${url}`)
}

/**
 * Builds the app once, then boots the production server against the fixture PokeAPI and an
 * in-memory database. Tests talk to it over HTTP, exactly as a browser would.
 */
export default async function setup(project: TestProject) {
  const fixture = await startFixtureServer()
  if (!process.env.SKIP_BUILD) {
    execFileSync('npx', ['nuxt', 'build'], { stdio: 'ignore' })
  }

  const port = await freePort()
  const app: ChildProcess = spawn('node', ['.output/server/index.mjs'], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      NUXT_DB_PATH: ':memory:',
      NUXT_POKEAPI_BASE_URL: fixture.url,
      NUXT_MAX_COLLECTION_SIZE: String(TEST_COLLECTION_CAP)
    },
    stdio: 'ignore'
  })
  const baseUrl = `http://127.0.0.1:${port}`
  await waitFor(`${baseUrl}/api/me`)

  project.provide('baseUrl', baseUrl)
  project.provide('fixtureUrl', fixture.url)
  project.provide('collectionCap', TEST_COLLECTION_CAP)

  return async () => {
    app.kill()
    await fixture.close()
  }
}

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string
    fixtureUrl: string
    collectionCap: number
  }
}
