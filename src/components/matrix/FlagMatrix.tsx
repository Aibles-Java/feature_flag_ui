import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { sortEnvironments, type MatrixIndex } from '@/api/flagMatrix'
import type { Environment } from '@/api/environments'
import type { FeatureFlag, FlagState } from '@/api/flags'
import { cn } from '@/lib/utils'
import MatrixCell from './MatrixCell'
import { useInView } from './useInView'

interface Props {
  flags: FeatureFlag[]
  environments: Environment[]
  /** Validated `?env=` (UUID that belongs to the project) or undefined. */
  focusEnvId?: string
  renderRowHeader: (flag: FeatureFlag) => ReactNode
  renderActions: (flag: FeatureFlag) => ReactNode
  detailHref?: (flag: FeatureFlag, envId: string) => string
  /**
   * Phase 2 data (S-2.15): states of every flag on this page from ONE request. A flag present here
   * never triggers per-cell requests; a flag absent (or no index at all = phase 1 fallback) uses
   * the lazy, D-20-limited per-cell path.
   */
  matrixStates?: MatrixIndex
}

const ENV_COL = 'minmax(120px,1fr)'
const ENV_COL_FOCUS = 'minmax(260px,2fr)'

/**
 * Read-only flag x environment matrix (S-1.4a) with a focus mode for one env (S-1.4b).
 * ARIA grid: arrow keys / Home / End / PageUp / PageDown move between cells (roving tabindex).
 * Server state is fetched per visible row and per cell through the shared D-20 limiter.
 */
export default function FlagMatrix({ flags, environments, focusEnvId, renderRowHeader, renderActions, detailHref, matrixStates }: Readonly<Props>) {
  const envs = sortEnvironments(environments)
  const nCols = envs.length + 2 // flag | envs... | actions
  const template = `minmax(220px,2fr) ${envs.map((e) => (e.id === focusEnvId ? ENV_COL_FOCUS : ENV_COL)).join(' ')} 90px`.replace('  ', ' ')
  const gridRef = useRef<HTMLTableElement>(null)
  const [active, setActive] = useState({ row: 0, col: 0 }) // 0 = header row, 0-based col

  const focusCell = (row: number, col: number) => {
    const r = Math.min(Math.max(row, 0), flags.length)
    const c = Math.min(Math.max(col, 0), nCols - 1)
    setActive({ row: r, col: c })
    gridRef.current?.querySelector<HTMLElement>(`[data-r="${r}"][data-c="${c}"]`)?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    // Only when the cell itself has focus; keys inside inner controls (switch, links) keep their meaning.
    const t = e.target as HTMLElement
    if (t.dataset.r === undefined) return
    const { row, col } = active
    const moves: Record<string, [number, number]> = {
      ArrowRight: [row, col + 1],
      ArrowLeft: [row, col - 1],
      ArrowDown: [row + 1, col],
      ArrowUp: [row - 1, col],
      Home: [row, 0],
      End: [row, nCols - 1],
      PageDown: [row + 10, col],
      PageUp: [row - 10, col],
    }
    const ctrlMoves: Partial<Record<string, [number, number]>> = { Home: [0, 0], End: [flags.length, nCols - 1] }
    const to = (e.ctrlKey ? ctrlMoves[e.key] : undefined) ?? moves[e.key]
    if (!to) return
    e.preventDefault()
    focusCell(to[0], to[1])
  }

  const cellProps = (r: number, c: number) => ({
    'data-r': r,
    'data-c': c,
    'aria-colindex': c + 1,
    tabIndex: active.row === r && active.col === c ? 0 : -1,
    onFocus: () => setActive((a) => (a.row === r && a.col === c ? a : { row: r, col: c })),
  })

  return (
    <table
      ref={gridRef}
      role="grid"
      tabIndex={-1}
      aria-label="Feature flags by environment"
      aria-rowcount={flags.length + 1}
      aria-colcount={nCols}
      onKeyDown={onKeyDown}
      className="block overflow-x-auto"
    >
      <thead className="block">
        <tr aria-rowindex={1} className="grid items-center bg-background border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground" style={{ gridTemplateColumns: template }}>
          <th scope="col" {...cellProps(0, 0)} className="sticky left-0 bg-background px-5 py-3 text-left font-bold">Flag</th>
          {envs.map((e, i) => (
            <th
              key={e.id}
              scope="col"
              {...cellProps(0, i + 1)}
              data-focus={e.id === focusEnvId ? 'true' : undefined}
              className={cn('px-3 py-3 text-left font-bold', e.id === focusEnvId && 'bg-brand-soft text-primary')}
            >
              <span className="inline-flex items-center gap-1">
                {e.name}
                {e.type === 'PRODUCTION' && <Lock className="h-3 w-3" role="img" aria-label="Production environment (locked)" />}
              </span>
            </th>
          ))}
          <th scope="col" {...cellProps(0, nCols - 1)} className="px-3 py-3 text-left font-bold">Actions</th>
        </tr>
      </thead>
      <tbody className="block divide-y divide-muted">
        {flags.map((f, ri) => (
          <MatrixRow key={f.id} flag={f} rowIndex={ri + 1} envs={envs} focusEnvId={focusEnvId} template={template} cellProps={cellProps} detailHref={detailHref} renderRowHeader={renderRowHeader} renderActions={renderActions} nCols={nCols} rowStates={matrixStates?.get(f.id)} />
        ))}
      </tbody>
    </table>
  )
}

interface RowProps {
  flag: FeatureFlag
  rowIndex: number
  envs: Environment[]
  focusEnvId?: string
  template: string
  nCols: number
  cellProps: (r: number, c: number) => Record<string, unknown>
  detailHref?: Props['detailHref']
  renderRowHeader: Props['renderRowHeader']
  renderActions: Props['renderActions']
  rowStates?: Map<string, FlagState>
}

function MatrixRow({ flag, rowIndex, envs, focusEnvId, template, nCols, cellProps, detailHref, renderRowHeader, renderActions, rowStates }: Readonly<RowProps>) {
  const ref = useRef<HTMLTableRowElement>(null)
  const seen = useInView(ref)
  return (
    // The row element itself is the viewport probe, so its height must exist before cells load.
    <tr ref={ref} aria-rowindex={rowIndex + 1} className="grid items-center hover:bg-background" style={{ gridTemplateColumns: template }}>
      <th scope="row" {...cellProps(rowIndex, 0)} className="sticky left-0 block min-w-0 bg-card px-5 py-4 text-left font-normal">{renderRowHeader(flag)}</th>
      {envs.map((e, i) => (
        <td key={e.id} {...cellProps(rowIndex, i + 1)} className={cn('block px-3 py-4', e.id === focusEnvId && 'bg-brand-soft/40')}>
          <MatrixCell flag={flag} env={e} active={seen} rowStates={rowStates} focused={e.id === focusEnvId} detailHref={detailHref} />
        </td>
      ))}
      <td {...cellProps(rowIndex, nCols - 1)} className="block px-3 py-4">{renderActions(flag)}</td>
    </tr>
  )
}
