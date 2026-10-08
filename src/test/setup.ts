import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import * as axeMatchers from 'vitest-axe/matchers'
import { afterEach, beforeEach, expect } from 'vitest'

expect.extend(axeMatchers)

beforeEach(() => {
  // Deterministic runtime config; mirrors public/env.js injected in the container.
  window.__ENV__ = { VITE_API_URL: 'http://api.test' }
})

afterEach(() => {
  cleanup()
  delete window.__ENV__
})
