// Runs the fixture PokeAPI as its own process for the e2e run (see playwright.config.ts).
import { FIXTURE_PORT } from './env.ts'
import { startFixtureServer } from '../fixtures/server.ts'

const { url } = await startFixtureServer(FIXTURE_PORT)
console.log(`fixture PokeAPI listening on ${url}`)
