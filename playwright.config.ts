import { defineConfig, devices } from '@playwright/test'
import { APP_PORT, APP_URL, FIXTURE_PORT, FIXTURE_URL } from './tests/e2e/env'

/**
 * The app runs as a production build against a fixture PokeAPI and a throwaway database, so the
 * suite needs no network. One worker, in file order: the app caches PokeAPI data for the life of
 * the process, so a few specs rely on running before anything has warmed the cache.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  use: { baseURL: APP_URL },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node tests/e2e/fixture-server.ts',
      url: `${FIXTURE_URL}/pokemon`,
      env: { FIXTURE_PORT: String(FIXTURE_PORT) },
    },
    {
      command: 'rm -f data/e2e.db data/e2e.db-wal data/e2e.db-shm && npm run build && node .output/server/index.mjs',
      // /api/me does not touch PokeAPI, so waiting for it leaves the app's cache cold.
      url: `${APP_URL}/api/me`,
      timeout: 240_000,
      env: {
        PORT: String(APP_PORT),
        NODE_ENV: 'production',
        NUXT_DB_PATH: 'data/e2e.db',
        NUXT_POKEAPI_BASE_URL: FIXTURE_URL,
      },
    },
  ],
})
