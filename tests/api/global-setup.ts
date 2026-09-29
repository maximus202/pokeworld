import { execFileSync } from 'node:child_process'
import type { TestProject } from 'vitest/node'
import { startFixtureServer } from '../fixtures/server'
import { startApp } from './app'

/** The collection cap the API tests run with, small enough to hit with the fixture Pokemon. */
export const TEST_COLLECTION_CAP = 4

/**
 * Builds the app once, then boots the production server against the fixture PokeAPI and an
 * in-memory database. Tests talk to it over HTTP, exactly as a browser would.
 * Set SKIP_BUILD=1 to reuse an existing `.output/`.
 */
export default async function setup(project: TestProject) {
  const fixture = await startFixtureServer()
  if (!process.env.SKIP_BUILD) {
    execFileSync('npx', ['nuxt', 'build'], { stdio: 'ignore' })
  }

  const app = await startApp({
    dbPath: ':memory:',
    pokeapiUrl: fixture.url,
    maxCollectionSize: TEST_COLLECTION_CAP,
  })

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
