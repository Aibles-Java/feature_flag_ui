import { describe, expect, it } from 'vitest'
import { isFlagCentricNavEnabled } from './runtimeFlags'

describe('isFlagCentricNavEnabled (S-1.11, D-19)', () => {
  it('defaults to the old behaviour when window.__ENV__ is absent', () => {
    delete window.__ENV__
    expect(isFlagCentricNavEnabled()).toBe(false)
  })

  it('defaults to the old behaviour when the key is missing', () => {
    window.__ENV__ = { VITE_API_URL: 'http://api.test' }
    expect(isFlagCentricNavEnabled()).toBe(false)
  })

  it.each(['', 'false', 'FALSE', '1', 'yes', 'enabled', ' '])(
    'treats unknown value %j as off',
    (v) => {
      window.__ENV__ = { FLAG_CENTRIC_NAV: v }
      expect(isFlagCentricNavEnabled()).toBe(false)
    },
  )

  it('is on only for the exact string "true"', () => {
    window.__ENV__ = { FLAG_CENTRIC_NAV: 'true' }
    expect(isFlagCentricNavEnabled()).toBe(true)
  })

  it('is read at call time, so a runtime config change needs no rebuild', () => {
    window.__ENV__ = { FLAG_CENTRIC_NAV: 'true' }
    expect(isFlagCentricNavEnabled()).toBe(true)
    window.__ENV__ = { FLAG_CENTRIC_NAV: 'false' }
    expect(isFlagCentricNavEnabled()).toBe(false)
  })
})
