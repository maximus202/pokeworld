import { defineConfig, devices } from '@playwright/test'

const APP_PORT = 4011
const FIXTURE_PORT = 4010
const fixtureUrl = `http://127.0.0.1:${FIXTURE_PORT}`
const dbPath = 'test-results/e2e.db'

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // PokeAPI is only called server-side, so browser interception can't stand in for it.
      command: 'node tests/fixtures/run.ts',
      port: FIXTURE_PORT,
      env: { FIXTURE_PORT: String(FIXTURE_PORT) },
      reuseExistingServer: false
    },
    {
      // Throwaway database and the fixture PokeAPI; never touches data/pokeworld.db.
      command: `npm run build && rm -f ${dbPath}* && node .output/server/index.mjs`,
      port: APP_PORT,
      timeout: 240_000,
      reuseExistingServer: false,
      env: {
        PORT: String(APP_PORT),
        HOST: '127.0.0.1',
        POKEAPI_BASE_URL: fixtureUrl,
        DB_PATH: dbPath,
        NUXT_POKEAPI_BASE_URL: fixtureUrl,
        NUXT_DB_PATH: dbPath
      }
    }
  ]
})
