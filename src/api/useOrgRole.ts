import { useQuery } from '@tanstack/react-query'
import { getMembers, type Member } from './orgs'
import { useAuthStore } from '@/stores/authStore'
import type { MemberRole } from './abac'

/**
 * The role a member list gives one user, or null if it does not mention them.
 *
 * Kept out of the hook so the decision can be tested without React. What remains in the hook is a
 * `useQuery` call and nothing else; testing that would only assert that react-query works.
 */
export function roleOf(members: Member[] | undefined, userId: string | null): MemberRole | null {
  if (!members || !userId) return null
  return members.find((m) => m.userId === userId)?.role ?? null
}

/**
 * The current user's role in one organisation.
 *
 * There is no `/me/permissions` endpoint, but org scope does not need one: any member may list the
 * organisation's members (`listMembers` gates on `isMember`, not on an action), and the caller's
 * own row carries the role. Since `effectiveActionsForOrg` is exactly `actionsForRole(orgRole)` —
 * grants are project-scoped and never widen an org-scope check — that role determines the
 * org-scope action set precisely.
 *
 * Returns `null` while loading, on failure, or if the user is somehow absent from the list.
 * Callers must treat `null` as "unknown", not "no permissions": greying out the UI because a
 * request was slow would be worse than letting the backend answer.
 */
export function useOrgRole(orgId: string | undefined): MemberRole | null {
  const userId = useAuthStore((s) => s.userId)

  // Shares the cache key with the Members screen, so opening one warms the other.
  const { data: members } = useQuery({
    queryKey: ['org-members', orgId],
    queryFn: () => getMembers(orgId!),
    enabled: !!orgId,
  })

  return roleOf(members, userId)
}
