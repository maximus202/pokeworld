import { defineConfig, devices } from '@playwright/test'

// The app runs as a production build against the fixture PokeAPI and a throwaway database, so
// the suite needs no network. Fixture and app ports are fixed so the tests can reach them.
export const FIXTURE_PORT = 4010
export const APP_PORT = 4011

export default defineConfig({
  testDir: 'tests/e2e',
  // One worker: the fixture server's failure controls and the app's PokeAPI cache are shared.
  // Every test still gets a fresh browser context, so each is a new visitor with an empty collection.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  outputDir: 'test-results/playwright',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: `http://127.0.0.1:${APP_PORT}`,
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `${process.env.SKIP_BUILD ? '' : 'npx nuxt build && '}node .output/server/index.mjs`,
    url: `http://127.0.0.1:${APP_PORT}/api/me`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      PORT: String(APP_PORT),
      NODE_ENV: 'production',
      NUXT_DB_PATH: 'test-results/e2e.db',
      NUXT_POKEAPI_BASE_URL: `http://127.0.0.1:${FIXTURE_PORT}`
    }
  }
})
