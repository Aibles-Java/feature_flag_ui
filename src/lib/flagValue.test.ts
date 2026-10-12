import { describe, expect, it } from 'vitest'
import { MAX_VALUE_LENGTH, previewValue, validateRollout, validateValue } from '@/lib/flagValue'

describe('validateValue (UX mirror of the server F19 check)', () => {
  it('accepts empty for every type', () => {
    for (const t of ['BOOLEAN', 'STRING', 'INTEGER', 'JSON'] as const) expect(validateValue(t, '')).toBeNull()
  })
  it('BOOLEAN accepts exactly true/false', () => {
    expect(validateValue('BOOLEAN', 'true')).toBeNull()
    expect(validateValue('BOOLEAN', 'True')).not.toBeNull()
  })
  it('INTEGER accepts a Long and rejects others', () => {
    expect(validateValue('INTEGER', '-42')).toBeNull()
    expect(validateValue('INTEGER', '9223372036854775807')).toBeNull()
    expect(validateValue('INTEGER', '9223372036854775808')).not.toBeNull()
    expect(validateValue('INTEGER', '1.5')).not.toBeNull()
    expect(validateValue('INTEGER', 'abc')).not.toBeNull()
  })
  it('JSON requires a complete document', () => {
    expect(validateValue('JSON', '{"a":[1]}')).toBeNull()
    expect(validateValue('JSON', '{"a":')).not.toBeNull()
  })
  it('enforces the 8192 boundary (8192 ok, 8193 rejected)', () => {
    expect(validateValue('STRING', 'a'.repeat(MAX_VALUE_LENGTH))).toBeNull()
    expect(validateValue('STRING', 'a'.repeat(MAX_VALUE_LENGTH + 1))).not.toBeNull()
  })
  it('never echoes the value in the message', () => {
    expect(validateValue('INTEGER', 'sensitive-xyz')).not.toContain('sensitive-xyz')
  })
})

describe('validateRollout / previewValue', () => {
  it('bounds 0..100 whole numbers', () => {
    expect(validateRollout('0')).toBeNull()
    expect(validateRollout('100')).toBeNull()
    expect(validateRollout('101')).not.toBeNull()
    expect(validateRollout('-1')).not.toBeNull()
    expect(validateRollout('')).not.toBeNull()
    expect(validateRollout('5.5')).not.toBeNull()
  })
  it('truncates long previews and flattens whitespace', () => {
    expect(previewValue('a\n b', 10)).toBe('a b')
    expect(previewValue('x'.repeat(100), 10)).toBe(`${'x'.repeat(10)}…`)
  })
})
