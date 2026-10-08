import { CHIP_VALUE_MAX_CHARS } from '@/config/matrixConfig'
import type { CellState } from '@/api/flagMatrix'
import type { Environment } from '@/api/environments'
import type { FeatureFlag } from '@/api/flags'

/** Truncated value for the chip; the full text stays in the focus-mode detail and the aria name. */
export function shortValue(value: string | null | undefined): string | null {
  if (value == null || value === '') return null
  return value.length > CHIP_VALUE_MAX_CHARS ? `${value.slice(0, CHIP_VALUE_MAX_CHARS)}…` : value
}

/** Screen-reader description of a cell, so state is never conveyed by colour alone (S-1.4a AC4). */
export function describeCell(flagName: string, envName: string, state: CellState): string {
  if (state === null) return `${flagName} in ${envName}: not configured`
  const parts = [state.enabled ? 'enabled' : 'disabled']
  const v = shortValue(state.value)
  if (v !== null) parts.push(`value ${v}`)
  if (state.rolloutPercent < 100) parts.push(`rollout ${state.rolloutPercent}%`)
  return `${flagName} in ${envName}: ${parts.join(', ')}`
}

/**
 * Quick toggle policy (S-1.4b AC2, solution-design 6.1/11): only BOOLEAN flags, only a non-PROD
 * focus env, only where a state already exists. PRODUCTION never gets one - it must go through the
 * guarded editor on the detail page (S-1.8/1.9). The backend still authorises every write.
 */
export const canQuickToggle = (flag: FeatureFlag, env: Environment) =>
  flag.valueType === 'BOOLEAN' && env.type !== 'PRODUCTION'
