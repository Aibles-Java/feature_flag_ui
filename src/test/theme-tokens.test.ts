// S-1.10 (F15): no hard-coded colours outside src/index.css; every semantic
// token has light + dark values; chip text/background pairs meet WCAG AA.
import { describe, expect, it } from 'vitest'

// Raw source of every ts/tsx/css file under src (resolved at transform time).
const sources = import.meta.glob<string>('/src/**/*.{ts,tsx,css}', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const css = sources['/src/index.css'].replace(/\r\n/g, '\n')

const HEX = /#[0-9a-fA-F]{3,8}\b/
const FUNC = /\b(rgba?|hsla?|oklch|oklab)\(/

describe('AC1: no hard-coded colours outside index.css', () => {
  const files = Object.keys(sources).filter(
    (f) => f !== '/src/index.css' && !f.startsWith('/src/test/') && !/\.test\.tsx?$/.test(f),
  )
  it('scans a non-trivial number of files', () => {
    expect(files.length).toBeGreaterThan(10)
  })
  it('has no hex or colour-function literals', () => {
    const offenders = files.flatMap((f) =>
      sources[f]
        .split('\n')
        .map((line, i) => ({ file: f, n: i + 1, line }))
        .filter(({ line }) => HEX.test(line) || FUNC.test(line))
        .map(({ file, n }) => `${file}:${n}`),
    )
    expect(offenders).toEqual([])
  })
})

// Raw Tailwind palette utilities (text-gray-500, bg-slate-100, ...) bypass the semantic tokens.
// The legacy pages still contain them (tracked for migration), so the ban is enforced on the
// matrix code (S-1.4) and on the matrix region of FlagsPage; extend NEW_CODE as pages migrate.
const PALETTE = /\b(?:[a-z-]+:)*[a-z]+-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/
describe('no raw Tailwind palette classes in migrated code', () => {
  it('detector catches known offenders', () => {
    for (const c of ['text-gray-900', 'bg-slate-100', 'hover:bg-amber-50', 'border-red-500']) expect(PALETTE.test(c)).toBe(true)
    for (const c of ['text-foreground', 'bg-chip-on', 'hover:bg-muted']) expect(PALETTE.test(c)).toBe(false)
  })
  const migrated = Object.keys(sources).filter(
    (f) => (f.startsWith('/src/components/matrix/') || f.startsWith('/src/api/flagMatrix') ) && !/\.test\.tsx?$/.test(f),
  )
  it('matrix components are palette-free', () => {
    expect(migrated.length).toBeGreaterThan(3)
    const offenders = migrated.filter((f) => PALETTE.test(sources[f]))
    expect(offenders).toEqual([])
  })
  it('the matrix region of FlagsPage is palette-free', () => {
    const src = sources['/src/pages/flags/FlagsPage.tsx']
    const region = src.slice(src.indexOf('{/* Matrix (flag-centric'), src.indexOf('{/* Table (legacy'))
    expect(region.length).toBeGreaterThan(500)
    expect(region.split('\n').filter((l) => PALETTE.test(l))).toEqual([])
  })
})

function block(selector: string): string {
  const m = new RegExp(`(^|\\n)${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(css)
  return m ? m[2] : ''
}
const light = block(':root')
const dark = block('.dark')
const themeInline = /@theme inline \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? ''

const NEW_TOKENS = [
  'brand-strong', 'brand-soft', 'brand-mid', 'brand-tint', 'brand-border', 'brand-light',
  'success', 'success-soft', 'success-text',
  'chip-on', 'chip-on-hover', 'chip-on-foreground', 'chip-off', 'chip-off-foreground', 'chip-off-hover',
  'faint', 'faint-strong',
]

describe('AC2: tokens declared for light and dark', () => {
  it.each(NEW_TOKENS)('%s has :root, .dark and @theme entries', (t) => {
    expect(light).toMatch(new RegExp(`--${t}:\\s*\\S`))
    expect(dark).toMatch(new RegExp(`--${t}:\\s*\\S`))
    expect(themeInline).toMatch(new RegExp(`--color-${t}:\\s*var\\(--${t}\\)`))
  })
})

function val(scope: string, name: string): string {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(scope)
  if (!m) throw new Error(`--${name} must be a 6-digit hex in scope`)
  return m[1]
}
function lum(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
export function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

// [foreground token, background token]; the chip pairs used in the UI.
const PAIRS: string[][] = [
  ['chip-on-foreground', 'chip-on'],
  ['chip-on-foreground', 'chip-on-hover'],
  ['chip-off-foreground', 'chip-off'],
  ['chip-off-foreground', 'chip-off-hover'],
  ['brand-strong', 'brand-soft'],
  ['brand-strong', 'brand-tint'], // brand-mid is border-only (no text pair)
  ['success-text', 'success-soft'],
]

describe('AC3: chip contrast >= 4.5:1 (WCAG AA) in both modes', () => {
  for (const [mode, scope] of [['light', light], ['dark', dark]] as const) {
    it.each(PAIRS)(`${mode}: %s on %s`, (fg, bg) => {
      const r = ratio(val(scope, fg), val(scope, bg))
      expect(r).toBeGreaterThanOrEqual(4.5)
    })
  }
})
