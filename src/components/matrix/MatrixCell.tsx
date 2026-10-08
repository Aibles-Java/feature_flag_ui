import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Lock, Minus } from 'lucide-react'
import { cellQueryKey, fetchCellState, invalidateStateQueries, type CellState } from '@/api/flagMatrix'
import { isStateConflict, withConflictReload, type StateConflictError } from '@/api/stateConflict'
import { toggleFlagEnabled } from '@/api/flagToggle'
import type { Environment } from '@/api/environments'
import type { FeatureFlag, FlagState } from '@/api/flags'
import { STATE_STALE_TIME_MS } from '@/config/matrixConfig'
import ErrorDialog from '@/components/ErrorDialog'
import StateConflictDialog from '@/components/flags/StateConflictDialog'
import { cn } from '@/lib/utils'
import { canQuickToggle, describeCell, shortValue } from './cellFormat'

interface Props {
  flag: FeatureFlag
  env: Environment
  /** Row is near the viewport; requests are only issued then (lazy). */
  active: boolean
  /** This env is the `?env=` focus column (detail mode + limited quick toggle). */
  focused: boolean
  detailHref?: (flag: FeatureFlag, envId: string) => string
  /**
   * States of this flag from the one-request matrix (S-2.15), keyed by env id. Present = no query
   * of our own: a missing env means "not configured". Absent = phase 1 per-cell fetch.
   */
  rowStates?: Map<string, FlagState>
}

export default function MatrixCell(props: Readonly<Props>) {
  if (props.rowStates) return <CellView {...props} state={props.rowStates.get(props.env.id) ?? null} />
  // Off-screen rows do not mount the query observer at all: an unmounted observer aborts its
  // queued request (see fetchCellState signal), so scrolled-away rows stop consuming D-20 slots.
  // Already-fetched data stays in the query cache and reappears instantly on scroll-back.
  if (!props.active) return <span className="text-xs text-muted-foreground" aria-busy="true">Loading…</span>
  return <ActiveCell {...props} />
}

function ActiveCell(props: Readonly<Props>) {
  const { flag, env } = props
  const { data: state, isPending, isError, refetch } = useQuery({
    queryKey: cellQueryKey(flag.id, env.id),
    queryFn: ({ signal }) => fetchCellState(flag.id, env.id, signal),
    staleTime: STATE_STALE_TIME_MS,
  })

  if (isPending) {
    return <span className="text-xs text-muted-foreground" aria-busy="true">Loading…</span>
  }
  if (isError) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-destructive">
        Failed to load
        <button type="button" className="underline" onClick={() => refetch()} aria-label={`Retry ${flag.name} in ${env.name}`}>
          Retry
        </button>
      </span>
    )
  }
  return <CellView {...props} state={state} />
}

function CellView({ flag, env, focused, detailHref, state }: Readonly<Props & { state: CellState }>) {
  if (state === null) {
    // F11: a missing state is normal, not an error - and the matrix never creates one (ADR-03).
    return <span role="img" aria-label={describeCell(flag.name, env.name, null)} className="text-xs text-muted-foreground">Not configured</span>
  }

  const v = shortValue(state.value)
  const chip = (
    <span
      role="img"
      aria-label={describeCell(flag.name, env.name, state)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
        state.enabled ? 'bg-chip-on text-chip-on-foreground' : 'bg-chip-off text-chip-off-foreground',
      )}
    >
      {state.enabled ? <Check className="h-3 w-3" aria-hidden="true" /> : <Minus className="h-3 w-3" aria-hidden="true" />}
      <span>{state.enabled ? 'On' : 'Off'}</span>
      {v !== null && <span className="font-mono font-normal">{v}</span>}
      {state.rolloutPercent < 100 && <span className="font-normal">{state.rolloutPercent}%</span>}
    </span>
  )

  if (!focused) return chip

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-2">
        {chip}
        {canQuickToggle(flag, env) && <QuickToggle flag={flag} env={env} state={state} />}
      </div>
      {state.value != null && state.value !== '' && (
        <span className="max-w-full break-all font-mono text-xs text-foreground">{state.value}</span>
      )}
      <span className="text-xs text-muted-foreground">Rollout: {state.rolloutPercent}%</span>
      <span className="text-xs text-muted-foreground">
        Last evaluated: {state.lastEvaluatedAt ? new Date(state.lastEvaluatedAt).toLocaleString() : 'never'}
      </span>
      {env.type === 'PRODUCTION' && (
        <ProdNotice flag={flag} env={env} href={detailHref?.(flag, env.id)} />
      )}
    </div>
  )
}

function ProdNotice({ flag, env, href }: Readonly<{ flag: FeatureFlag; env: Environment; href?: string }>): ReactNode {
  return (
    <span className="inline-flex flex-col gap-0.5 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Lock className="h-3 w-3" aria-hidden="true" />
        Production changes are made from the flag detail page.
      </span>
      {href && (
        <Link to={href} className="text-primary underline" aria-label={`Open ${flag.name} in ${env.name} in the detail page`}>
          Open detail page
        </Link>
      )}
    </span>
  )
}

function QuickToggle({ flag, env, state }: Readonly<{ flag: FeatureFlag; env: Environment; state: FlagState }>) {
  const qc = useQueryClient()
  const inFlight = useRef(false)
  const [conflict, setConflict] = useState<StateConflictError | null>(null)
  const enabled = state.enabled
  const toggle = useMutation({
    // Sends the version of the state shown in this cell; a stale one is a 409 (S-2.16, ADR-07).
    mutationFn: (next: boolean) => withConflictReload(flag.id, env.id, () => toggleFlagEnabled(flag.id, env.id, next, state)),
    onError: (e) => {
      if (isStateConflict(e)) setConflict(e)
    },
    // Success: matrix/states/history/state caches refresh. Conflict or failure: the same refresh
    // re-reads the row, so the cell shows the server's value (the switch never keeps a lost toggle).
    onSettled: () => {
      inFlight.current = false
      return invalidateStateQueries(qc, flag, env.id)
    },
  })
  // While the write is in flight show the requested value; on failure `isPending` drops and the
  // switch snaps back to the server value (AC3 revert) while the error dialog explains why.
  const checked = toggle.isPending ? !!toggle.variables : enabled
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`Toggle ${flag.name} in ${env.name}`}
        disabled={toggle.isPending}
        onClick={() => {
          if (inFlight.current) return
          inFlight.current = true
          toggle.mutate(!enabled)
        }}
        className={cn(
          'inline-flex h-6 w-10 items-center rounded-full border border-border px-0.5 transition-colors disabled:opacity-60',
          checked ? 'justify-end bg-chip-on' : 'justify-start bg-chip-off',
        )}
      >
        <span className="h-4 w-4 rounded-full bg-background shadow" aria-hidden="true" />
      </button>
      <ErrorDialog error={isStateConflict(toggle.error) ? null : toggle.error} onClose={() => toggle.reset()} />
      <StateConflictDialog
        open={conflict !== null}
        subject={`${flag.name} in ${env.name}`}
        latest={conflict?.latest ?? null}
        onClose={() => {
          setConflict(null)
          toggle.reset()
        }}
      />
    </>
  )
}
