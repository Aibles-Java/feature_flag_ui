import { describe, it, expect } from 'vitest'
import { roleOf } from './useOrgRole'
import type { Member } from './orgs'

const member = (userId: string, role: Member['role']): Member => ({
  userId,
  email: `${userId}@example.com`,
  firstName: '',
  lastName: '',
  role,
})

describe('roleOf', () => {
  it('finds the caller among the organisation members', () => {
    expect(roleOf([member('a', 'VIEWER'), member('b', 'OWNER')], 'b')).toBe('OWNER')
  })

  it('returns null while the member list has not loaded', () => {
    // Callers must read null as "unknown", not "no permissions" - greying out the UI because a
    // request was slow would be worse than letting the backend answer.
    expect(roleOf(undefined, 'a')).toBeNull()
  })

  it('returns null when nobody is signed in', () => {
    expect(roleOf([member('a', 'OWNER')], null)).toBeNull()
  })

  it('returns null when the caller is not in the list', () => {
    expect(roleOf([member('a', 'OWNER')], 'someone-else')).toBeNull()
  })
})
