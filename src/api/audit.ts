import api from './axios'
import { toPage, type PageParams, type PageResponse } from './types'

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'ARCHIVE' | 'UNARCHIVE' | 'ROTATE_KEY'

export type AuditEntityType =
  | 'ORGANIZATION'
  | 'PROJECT'
  | 'ENVIRONMENT'
  | 'FEATURE_FLAG'
  | 'FLAG_STATE'
  | 'MEMBER'

export interface AuditLogEntry {
  id: string
  actorUserId: string | null
  orgId: string
  action: AuditAction
  entityType: AuditEntityType
  entityId: string | null
  /**
   * Free-form snapshots of the entity before/after the change, so their keys vary by entity type.
   * Null for creates (no before) and deletes (no after), and for API-key rotation both are null —
   * the backend deliberately never records the key itself.
   */
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
  createdAt: string
}

/**
 * Newest-first, paginated. The audit log is append-only and outlives the entities it references,
 * so `entityId` may point at something already deleted — never assume it still resolves.
 */
export const getAuditLog = (orgId: string, params?: PageParams) =>
  api
    .get<PageResponse<AuditLogEntry>>(`/organisations/${orgId}/audit-log`, { params })
    .then((r) => toPage(r.data))
