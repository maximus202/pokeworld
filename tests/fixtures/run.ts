// Standalone entry so Playwright can start the PokeAPI fixture server as a web server.
import { startFixtureServer } from './server.ts'

const port = Number(process.env.FIXTURE_PORT ?? 4010)
const server = await startFixtureServer(port)
console.log(`PokeAPI fixture server listening on ${server.url}`)
process.on('SIGTERM', () => void server.close().then(() => process.exit(0)))
process.on('SIGINT', () => void server.close().then(() => process.exit(0)))
