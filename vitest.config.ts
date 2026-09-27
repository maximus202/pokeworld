import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts']
        }
      },
      {
        test: {
          name: 'api',
          environment: 'node',
          include: ['tests/api/**/*.test.ts'],
          // Boots a real Nuxt server, which needs a build first.
          testTimeout: 60_000,
          hookTimeout: 240_000,
          fileParallelism: false
        }
      },
      await defineVitestProject({
        test: {
          name: 'component',
          environment: 'nuxt',
          include: ['tests/components/**/*.test.ts']
        }
      })
    ]
  }
})
