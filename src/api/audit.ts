import api from './axios'
import type { Page } from './page'

/** Mirrors `AuditAction`. */
export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ARCHIVE'
  | 'UNARCHIVE'
  | 'INVITE_MEMBER'
  | 'REMOVE_MEMBER'
  | 'ROTATE_API_KEY'
  | 'CHANGE_STATE'
  | 'GRANT_PERMISSION'
  | 'REVOKE_PERMISSION'
  | 'CLONE'
  | 'IMPORT'

/** Mirrors `AuditEntityType`. */
export type AuditEntityType =
  | 'ORGANIZATION'
  | 'PROJECT'
  | 'ENVIRONMENT'
  | 'FEATURE_FLAG'
  | 'FLAG_STATE'
  | 'MEMBER'
  | 'API_KEY'
  | 'PERMISSION_GRANT'
  | 'CUSTOM_ROLE'

export interface AuditLogEntry {
  id: string
  actorUserId: string
  orgId: string
  action: AuditAction
  entityType: AuditEntityType
  entityId: string
  /** Free-form entity snapshots; shape varies per entity type, so they stay unknown. */
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
  createdAt: string
}

export interface AuditQuery {
  page?: number
  size?: number
}

/**
 * Unlike the other list helpers this keeps the page envelope: an audit log is the one screen
 * that genuinely needs paging controls rather than just the rows.
 *
 * The backend already sorts by `createdAt,id` descending by default — don't pass `sort` unless
 * the user asks for a different order, or the tie-break on `id` is lost and rows written in the
 * same millisecond can shuffle between pages.
 */
export const getAuditLog = (orgId: string, params: AuditQuery = {}) =>
  api
    .get<Page<AuditLogEntry>>(`/organisations/${orgId}/audit-log`, { params })
    .then((r) => r.data)
