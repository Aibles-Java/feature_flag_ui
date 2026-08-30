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
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      // Only the logic layer is unit-tested; UI components/pages are excluded
      // here and via sonar.coverage.exclusions so the metric stays meaningful.
      include: ['src/stores/authStore.ts', 'src/api/auth.ts', 'src/api/axios.ts'],
    },
  },
})
