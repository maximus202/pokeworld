import { rmSync } from 'node:fs'
import { startFixtureServer } from '../fixtures/server'

export default async function globalSetup() {
  for (const suffix of ['', '-wal', '-shm']) rmSync(`test-results/e2e.db${suffix}`, { force: true })
  const fixture = await startFixtureServer(4010)
  return () => fixture.close()
}
