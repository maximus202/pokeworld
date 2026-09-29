import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { TestProject } from 'vitest/node'
import { startFixtureServer } from '../fixtures/server'
import { startApp } from './app'

const root = fileURLToPath(new URL('../..', import.meta.url))

/** The collection cap the API tests run with, small enough to hit with the fixture Pokemon. */
export const TEST_COLLECTION_CAP = 4

function build() {
  try {
    execFileSync('npx', ['nuxt', 'build'], { cwd: root, encoding: 'utf8', stdio: 'pipe' })
  }
  catch (error) {
    const { stdout = '', stderr = '' } = error as { stdout?: string, stderr?: string }
    throw new Error(`nuxt build failed:\n${stdout}\n${stderr}`)
  }
}

/**
 * Builds the app once, then boots the production server against the fixture PokeAPI and an
 * in-memory database. Tests talk to it over HTTP, exactly as a browser would.
 * Set SKIP_BUILD=1 to reuse an existing `.output/` (it fails if there is none).
 */
export default async function setup(project: TestProject) {
  if (process.env.SKIP_BUILD) {
    if (!existsSync(`${root}.output/server/index.mjs`)) {
      throw new Error('SKIP_BUILD is set but .output/ does not exist. Run `npm run build` first.')
    }
  }
  else {
    build()
  }

  const fixture = await startFixtureServer()
  let app
  try {
    app = await startApp({
      cwd: root,
      dbPath: ':memory:',
      pokeapiUrl: fixture.url,
      maxCollectionSize: TEST_COLLECTION_CAP,
    })
  }
  catch (error) {
    await fixture.close()
    throw error
  }

  project.provide('baseUrl', app.baseUrl)
  project.provide('fixtureUrl', fixture.url)
  project.provide('collectionCap', TEST_COLLECTION_CAP)

  return async () => {
    app.stop()
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
