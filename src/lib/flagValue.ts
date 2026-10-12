import type { FlagValueType } from '@/api/flags'

/** Server limit on `value` (BE `app.flag-value.max-length`, D-10); UTF-16 code units. */
export const MAX_VALUE_LENGTH = 8192

const LONG_MIN = -(2n ** 63n)
const LONG_MAX = 2n ** 63n - 1n

/**
 * UX-only mirror of the server's `FlagValueValidator` (F19). The server stays the authority and
 * returns 400 for anything this lets through. Empty text means "no value" and is always valid.
 * Messages never echo the value (it may be mistakenly sensitive).
 */
export function validateValue(type: FlagValueType, text: string): string | null {
  if (text === '') return null
  if (text.length > MAX_VALUE_LENGTH) return `Value must be at most ${MAX_VALUE_LENGTH} characters.`
  switch (type) {
    case 'BOOLEAN':
      return text === 'true' || text === 'false' ? null : 'Value must be true or false.'
    case 'INTEGER': {
      if (!/^[+-]?\d+$/.test(text)) return 'Value must be a whole number.'
      const n = BigInt(text)
      return n >= LONG_MIN && n <= LONG_MAX ? null : 'Value is outside the supported integer range.'
    }
    case 'JSON':
      try {
        JSON.parse(text)
        return null
      } catch {
        return 'Value must be valid JSON.'
      }
    default:
      return null
  }
}

export function validateRollout(text: string): string | null {
  if (!/^\d+$/.test(text.trim())) return 'Rollout must be a whole number from 0 to 100.'
  const n = Number(text)
  return n >= 0 && n <= 100 ? null : 'Rollout must be a whole number from 0 to 100.'
}

/** Short single-line preview for cards; always rendered as text by React. */
export function previewValue(value: string, max = 80): string {
  const flat = value.replace(/\s+/g, ' ')
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

/** D-10: static advisory shown next to every editable value; no secret scanning in v1. */
export const SECRET_ADVISORY =
  'Do not put secrets in the value. It is stored in plain text and is sent in audit records, webhooks and Slack notifications.'
