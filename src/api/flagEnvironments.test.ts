import { describe, expect, it } from 'vitest'
import { buildUpdateBody } from './flagEnvironments'

const input = { flagId: 'f', envId: 'e', enabled: true, rolloutPercent: 10 }

describe('buildUpdateBody version (S-2.16)', () => {
  it('sends the loaded version', () => {
    expect(buildUpdateBody({ ...input, version: 4 }).version).toBe(4)
  })
  it('sends version 0', () => {
    expect(buildUpdateBody({ ...input, version: 0 }).version).toBe(0)
  })
  it('omits version when there is none (older backend)', () => {
    expect('version' in buildUpdateBody(input)).toBe(false)
    expect('version' in buildUpdateBody({ ...input, version: null })).toBe(false)
  })
})
