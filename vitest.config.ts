import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    // index.css is read as raw text by the theme-token test (S-1.10).
    css: { include: [/index\.css/] },
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      // Only the logic layer is unit-tested; UI components/pages are excluded
      // here and via sonar.coverage.exclusions so the metric stays meaningful.
      include: [
        'src/stores/authStore.ts',
        'src/api/auth.ts',
        'src/api/axios.ts',
        'src/api/abac.ts',
        'src/api/audit.ts',
        'src/api/environments.ts',
        'src/api/grants.ts',
        'src/api/problem.ts',
        'src/api/roles.ts',
        'src/api/apiKeys.ts',
      ],
    },
  },
})
