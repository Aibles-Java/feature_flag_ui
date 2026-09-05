import { describe, it, expect } from 'vitest'
import {
  ACTION_GROUPS,
  ALL_ACTIONS,
  PRODUCTION_COUNTERPART,
  ROLE_ACTIONS,
  actionLabel,
  conferableActions,
  type Action,
} from './abac'

describe('abac vocabulary', () => {
  it('groups every action exactly once', () => {
    expect(new Set(ALL_ACTIONS).size).toBe(ALL_ACTIONS.length)
  })

  it('covers the backend enum', () => {
    // Mirrors org.aibles.feature_flag.domain.enums.Action. If the backend adds one, this fails
    // and points at the file that has to learn about it.
    const backend: Action[] = [
      'FLAG_READ', 'FLAG_CREATE', 'FLAG_UPDATE', 'FLAG_DELETE', 'FLAG_ARCHIVE',
      'FLAG_ARCHIVE_PRODUCTION', 'FLAG_STATE_UPDATE', 'FLAG_STATE_UPDATE_PRODUCTION',
      'ENV_READ', 'ENV_CREATE', 'ENV_UPDATE', 'ENV_DELETE', 'ENV_DELETE_PRODUCTION',
      'ENV_ROTATE_KEY', 'ENV_ROTATE_KEY_PRODUCTION', 'ENV_MANAGE_PROTECTION',
      'PROJECT_READ', 'PROJECT_CREATE', 'PROJECT_UPDATE', 'PROJECT_DELETE',
      'ORG_UPDATE', 'ORG_DELETE', 'MEMBER_INVITE', 'MEMBER_MANAGE', 'GRANT_MANAGE',
      'ROLE_MANAGE', 'AUDIT_READ',
      'ENV_EXPORT', 'WEBHOOK_READ', 'WEBHOOK_MANAGE',
      'ORG_READ', 'MEMBER_READ', 'WEBHOOK_MANAGE_PRODUCTION',
    ]
    expect([...ALL_ACTIONS].sort()).toEqual([...backend].sort())
  })

  it('puts every production-elevated counterpart in the Production group', () => {
    const production = ACTION_GROUPS.find((g) => g.label === 'Production')!
    expect([...production.actions].sort()).toEqual(
      [...Object.values(PRODUCTION_COUNTERPART)].sort()
    )
  })

  it('renders an enum value as a sentence', () => {
    expect(actionLabel('FLAG_STATE_UPDATE')).toBe('Flag state update')
    expect(actionLabel('AUDIT_READ')).toBe('Audit read')
  })
})

describe('role action mirror', () => {
  it('OWNER holds every action', () => {
    // PermissionService builds owner from admin from viewer, and the union covers the enum.
    expect([...ROLE_ACTIONS.OWNER].sort()).toEqual([...ALL_ACTIONS].sort())
  })

  it('is strictly nested viewer < admin < owner, as the backend builds it', () => {
    const viewer = new Set(ROLE_ACTIONS.VIEWER)
    const admin = new Set(ROLE_ACTIONS.ADMIN)
    expect(ROLE_ACTIONS.VIEWER.every((a) => admin.has(a))).toBe(true)
    expect(ROLE_ACTIONS.ADMIN.every((a) => new Set(ROLE_ACTIONS.OWNER).has(a))).toBe(true)
    expect(admin.size).toBeGreaterThan(viewer.size)
  })

  it('pins the counts so a backend table change fails here instead of confusing a user', () => {
    // Mirrors PermissionService.buildRoleActions(): 4 / 4+14 / 18+9.
    expect(ROLE_ACTIONS.MEMBER).toHaveLength(2)
    expect(ROLE_ACTIONS.VIEWER).toHaveLength(7)
    expect(ROLE_ACTIONS.ADMIN).toHaveLength(23)
    expect(ROLE_ACTIONS.OWNER).toHaveLength(33)
  })

  it('MEMBER reaches no project but can still read the organisation it belongs to', () => {
    const member = conferableActions('MEMBER')!
    expect([...member].sort()).toEqual(['MEMBER_READ', 'ORG_READ'])
    // The whole point: no project reach of its own.
    expect(member.has('PROJECT_READ')).toBe(false)
    expect(member.has('FLAG_READ')).toBe(false)
  })

  it('VIEWER is read-only and cannot confer ROLE_MANAGE', () => {
    expect(ROLE_ACTIONS.VIEWER.every((a) => a.endsWith('_READ'))).toBe(true)
    expect(conferableActions('VIEWER')!.has('ROLE_MANAGE')).toBe(false)
    expect(conferableActions('ADMIN')!.has('ROLE_MANAGE')).toBe(true)
  })

  it('ADMIN cannot confer any production-elevated action', () => {
    const admin = conferableActions('ADMIN')!
    for (const elevated of Object.values(PRODUCTION_COUNTERPART)) {
      expect(admin.has(elevated)).toBe(false)
    }
  })

  it('returns null for an unknown role so callers fall back to offering everything', () => {
    expect(conferableActions(null)).toBeNull()
    expect(conferableActions(undefined)).toBeNull()
  })
})
