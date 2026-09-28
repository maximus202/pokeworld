import { startFixtureServer } from './server'

// Standalone fixture server, used by Playwright and for offline demos:
//   FIXTURE_PORT=4010 npx tsx tests/fixtures/run.ts
const port = Number(process.env.FIXTURE_PORT ?? 4010)
const server = await startFixtureServer(port)
console.log(`Fixture PokeAPI listening on ${server.url}`)
