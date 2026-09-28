import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node'
        }
      },
      {
        test: {
          name: 'api',
          include: ['tests/api/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['tests/api/global-setup.ts'],
          testTimeout: 15000,
          // One shared server and in-memory database; each test uses its own visitor.
          fileParallelism: false
        }
      },
      await defineVitestProject({
        test: {
          name: 'component',
          include: ['tests/components/**/*.test.ts'],
          environment: 'nuxt'
        }
      })
    ]
  }
})
