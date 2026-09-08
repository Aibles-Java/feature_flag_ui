/**
 * Shared vocabulary for the backend's ABAC model.
 *
 * These types mirror enums the backend owns; they are duplicated here rather than generated
 * because the two services deploy independently. When the backend adds an `Action`, this file
 * is the one place the UI has to learn about it — an unknown value sent to
 * `POST /organisations/{orgId}/roles` is rejected as a deserialisation error, not silently
 * dropped, so drift fails loudly rather than quietly granting nothing.
 */

/** Mirrors `org.aibles.feature_flag.domain.enums.Action` — the vocabulary the PDP checks against. */
export type Action =
  | 'FLAG_READ'
  | 'FLAG_CREATE'
  | 'FLAG_UPDATE'
  | 'FLAG_DELETE'
  | 'FLAG_ARCHIVE'
  | 'FLAG_ARCHIVE_PRODUCTION'
  | 'FLAG_STATE_UPDATE'
  | 'FLAG_STATE_UPDATE_PRODUCTION'
  | 'ENV_READ'
  | 'ENV_CREATE'
  | 'ENV_UPDATE'
  | 'ENV_DELETE'
  | 'ENV_DELETE_PRODUCTION'
  | 'ENV_ROTATE_KEY'
  | 'ENV_ROTATE_KEY_PRODUCTION'
  | 'ENV_MANAGE_PROTECTION'
  | 'ENV_EXPORT'
  | 'WEBHOOK_READ'
  | 'WEBHOOK_MANAGE'
  | 'WEBHOOK_MANAGE_PRODUCTION'
  | 'PROJECT_READ'
  | 'PROJECT_CREATE'
  | 'PROJECT_UPDATE'
  | 'PROJECT_DELETE'
  | 'ORG_READ'
  | 'ORG_UPDATE'
  | 'ORG_DELETE'
  | 'MEMBER_READ'
  | 'MEMBER_INVITE'
  | 'MEMBER_MANAGE'
  | 'GRANT_MANAGE'
  | 'ROLE_MANAGE'
  | 'AUDIT_READ'

/** Mirrors `MemberRole`. Org-level source of truth; also usable as a built-in role on a grant. */
export type MemberRole = 'OWNER' | 'ADMIN' | 'VIEWER' | 'MEMBER'

/** Mirrors `EnvType`. Drives the production-elevated rules on the backend. */
export type EnvType = 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION'

export const ENV_TYPES: EnvType[] = ['DEVELOPMENT', 'STAGING', 'PRODUCTION']

/** Ordered widest to narrowest, which is how the role selector should read. */
export const MEMBER_ROLES: MemberRole[] = ['OWNER', 'ADMIN', 'VIEWER', 'MEMBER']

/**
 * The four actions the backend rewrites to an OWNER-only `*_PRODUCTION` counterpart when the
 * call reaches a PRODUCTION environment. Listing them lets the role editor explain why ticking
 * the plain action is not enough for production, without the UI re-implementing the rule.
 */
export const PRODUCTION_COUNTERPART: Partial<Record<Action, Action>> = {
  FLAG_STATE_UPDATE: 'FLAG_STATE_UPDATE_PRODUCTION',
  FLAG_ARCHIVE: 'FLAG_ARCHIVE_PRODUCTION',
  ENV_ROTATE_KEY: 'ENV_ROTATE_KEY_PRODUCTION',
  ENV_DELETE: 'ENV_DELETE_PRODUCTION',
  WEBHOOK_MANAGE: 'WEBHOOK_MANAGE_PRODUCTION',
}

export interface ActionGroup {
  label: string
  hint?: string
  actions: Action[]
}

/** Grouping is presentation only — the backend stores a flat set. */
export const ACTION_GROUPS: ActionGroup[] = [
  {
    label: 'Flags',
    actions: [
      'FLAG_READ',
      'FLAG_CREATE',
      'FLAG_UPDATE',
      'FLAG_DELETE',
      'FLAG_ARCHIVE',
      'FLAG_STATE_UPDATE',
    ],
  },
  {
    label: 'Environments',
    actions: [
      'ENV_READ',
      'ENV_CREATE',
      'ENV_UPDATE',
      'ENV_DELETE',
      'ENV_ROTATE_KEY',
      'ENV_MANAGE_PROTECTION',
      'ENV_EXPORT',
    ],
  },
  {
    label: 'Webhooks',
    actions: ['WEBHOOK_READ', 'WEBHOOK_MANAGE'],
  },
  {
    label: 'Projects',
    actions: ['PROJECT_READ', 'PROJECT_CREATE', 'PROJECT_UPDATE', 'PROJECT_DELETE'],
  },
  {
    label: 'Organisation',
    actions: ['ORG_READ', 'ORG_UPDATE', 'ORG_DELETE'],
  },
  {
    label: 'Members & roles',
    actions: ['MEMBER_READ', 'MEMBER_INVITE', 'MEMBER_MANAGE', 'GRANT_MANAGE', 'ROLE_MANAGE'],
  },
  {
    label: 'Audit',
    actions: ['AUDIT_READ'],
  },
  {
    label: 'Production',
    hint:
      'Reserved for organisation OWNERs. An action here is what the plain action above is ' +
      'rewritten to when it reaches a PRODUCTION environment — granting the plain action alone ' +
      'never reaches production.',
    actions: [
      'FLAG_STATE_UPDATE_PRODUCTION',
      'FLAG_ARCHIVE_PRODUCTION',
      'ENV_ROTATE_KEY_PRODUCTION',
      'ENV_DELETE_PRODUCTION',
      'WEBHOOK_MANAGE_PRODUCTION',
    ],
  },
]

export const ALL_ACTIONS: Action[] = ACTION_GROUPS.flatMap((g) => g.actions)

/** `FLAG_STATE_UPDATE` → `Flag state update`. Keeps the enum readable without a lookup table. */
export const actionLabel = (action: Action): string => {
  const words = action.toLowerCase().split('_')
  return words
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/**
 * Mirror of `PermissionService.buildRoleActions()`.
 *
 * **This is a display aid, never an authorization decision.** The backend re-checks everything;
 * this table only lets the custom-role editor grey out actions the current user could not
 * confer anyway, instead of offering them and reporting a 403 afterwards.
 *
 * At org scope the mirror is exact rather than approximate: `effectiveActionsForOrg` is
 * literally `actionsForRole(orgRole)` with no grant union (grants are project-scoped), so a
 * role read from `GET /organisations/{orgId}/members` yields the same set the backend's
 * `requireCanConfer` compares against.
 *
 * Drift is the risk: an action added to ADMIN on the backend would be greyed out here until
 * this table is updated, blocking something legitimate. `abac.test.ts` pins the totals so the
 * mismatch shows up as a failing test rather than a confused user.
 */
const VIEWER_ACTIONS: Action[] = [
  'FLAG_READ',
  'ENV_READ',
  'PROJECT_READ',
  'AUDIT_READ',
  'WEBHOOK_READ',
  'ORG_READ',
  'MEMBER_READ',
]

const ADMIN_ACTIONS: Action[] = [
  ...VIEWER_ACTIONS,
  'FLAG_CREATE',
  'FLAG_UPDATE',
  'FLAG_ARCHIVE',
  'FLAG_STATE_UPDATE',
  'ENV_CREATE',
  'ENV_UPDATE',
  'ENV_ROTATE_KEY',
  'PROJECT_CREATE',
  'PROJECT_UPDATE',
  'ORG_UPDATE',
  'MEMBER_INVITE',
  'MEMBER_MANAGE',
  'GRANT_MANAGE',
  'ROLE_MANAGE',
  'ENV_EXPORT',
  'WEBHOOK_MANAGE',
]

const OWNER_ACTIONS: Action[] = [
  ...ADMIN_ACTIONS,
  'FLAG_DELETE',
  'ENV_DELETE',
  'PROJECT_DELETE',
  'ORG_DELETE',
  'FLAG_STATE_UPDATE_PRODUCTION',
  'FLAG_ARCHIVE_PRODUCTION',
  'ENV_ROTATE_KEY_PRODUCTION',
  'ENV_DELETE_PRODUCTION',
  'ENV_MANAGE_PROTECTION',
  'WEBHOOK_MANAGE_PRODUCTION',
]

const MEMBER_ACTIONS: Action[] = ['ORG_READ', 'MEMBER_READ']

export const ROLE_ACTIONS: Record<MemberRole, Action[]> = {
  MEMBER: MEMBER_ACTIONS,
  VIEWER: VIEWER_ACTIONS,
  ADMIN: ADMIN_ACTIONS,
  OWNER: OWNER_ACTIONS,
}

/**
 * What this role can hand to someone else. `null` (role unknown, e.g. the member list has not
 * loaded) means "do not claim to know" — callers should fall back to offering everything and
 * letting the backend answer, rather than greying out the whole screen on a slow request.
 */
export const conferableActions = (role: MemberRole | null | undefined): Set<Action> | null =>
  role ? new Set(ROLE_ACTIONS[role]) : null
