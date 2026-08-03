# Feature Flag UI — Brand Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the feature-flag UI visual design with the Onward brand guide — font, color tokens, sidebar identity, and auth pages — without changing any business logic.

**Architecture:** Pure styling changes propagated top-down: CSS custom properties in `index.css` establish the token foundation; component files consume those tokens via Tailwind utility classes. No new components are created; no API or state logic is touched.

**Tech Stack:** React 19, TypeScript, Vite, TailwindCSS v4, shadcn/ui, `@fontsource/be-vietnam-pro`

## Global Constraints

- Brand primary blue: `#2563EB` (hover/dark: `#1D4ED8`)
- Brand accent green: `#10B981` — only for positive signals (enabled state, success), never for primary action buttons
- Brand navy sidebar: `#0F172A`
- Brand background: `#F8FAFC`
- Brand text: `#0F172A`, muted: `#64748B`, border: `#E2E8F0`
- Font: `'Be Vietnam Pro'` (package: `@fontsource/be-vietnam-pro`)
- Base radius token: `0.75rem` (12px)
- No logic changes — only className / style / import changes
- No new files — modify existing files only
- Type badges (BOOLEAN/STRING/INTEGER/JSON) keep their existing semantic colors (indigo/emerald/orange/purple) — these are developer classification colors, not brand colors

---

## File Map

| File | Change type | What changes |
|---|---|---|
| `package.json` | dependency add | `@fontsource/be-vietnam-pro` |
| `src/index.css` | token overhaul | font import, `:root` CSS vars, `@theme inline` font |
| `src/components/layout/AppLayout.tsx` | visual only | sidebar bg, Onward logo SVG, nav active states, avatar/badge colors |
| `src/pages/flags/FlagsPage.tsx` | visual only | stats cards, FlagToggle pill, table dots, action button hovers, archived section |
| `src/pages/auth/LoginPage.tsx` | visual only | brand panel gradient, logo/branding, link color |
| `src/pages/auth/RegisterPage.tsx` | visual only | brand panel gradient, logo/branding, link color |

---

## Task 1: Foundation — Font + CSS Design Tokens

**Files:**
- Modify: `package.json` (add dependency)
- Modify: `src/index.css` (font import + all CSS custom properties)

**Interfaces:**
- Produces: CSS custom properties consumed by all subsequent tasks via Tailwind's `var()` binding. Every `bg-background`, `text-foreground`, `bg-primary`, `border-border`, `rounded-lg` etc. in all components reflects these values automatically.

- [ ] **Step 1: Install font package**

```bash
cd /Users/oanhhkim/Documents/digital_banking/feature-flag-ui
npm install @fontsource/be-vietnam-pro
```

Expected: Package added to `node_modules/@fontsource/be-vietnam-pro`, entry added to `package.json` dependencies.

- [ ] **Step 2: Update `src/index.css` — replace font import and update all tokens**

Replace the entire file content with the following (all `@import` order and Tailwind directives must be preserved):

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource/be-vietnam-pro/400.css";
@import "@fontsource/be-vietnam-pro/500.css";
@import "@fontsource/be-vietnam-pro/600.css";
@import "@fontsource/be-vietnam-pro/700.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
    --font-heading: var(--font-sans);
    --font-sans: 'Be Vietnam Pro', Inter, system-ui, sans-serif;
    --color-sidebar-ring: var(--sidebar-ring);
    --color-sidebar-border: var(--sidebar-border);
    --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
    --color-sidebar-accent: var(--sidebar-accent);
    --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
    --color-sidebar-primary: var(--sidebar-primary);
    --color-sidebar-foreground: var(--sidebar-foreground);
    --color-sidebar: var(--sidebar);
    --color-chart-5: var(--chart-5);
    --color-chart-4: var(--chart-4);
    --color-chart-3: var(--chart-3);
    --color-chart-2: var(--chart-2);
    --color-chart-1: var(--chart-1);
    --color-ring: var(--ring);
    --color-input: var(--input);
    --color-border: var(--border);
    --color-destructive: var(--destructive);
    --color-accent-foreground: var(--accent-foreground);
    --color-accent: var(--accent);
    --color-muted-foreground: var(--muted-foreground);
    --color-muted: var(--muted);
    --color-secondary-foreground: var(--secondary-foreground);
    --color-secondary: var(--secondary);
    --color-primary-foreground: var(--primary-foreground);
    --color-primary: var(--primary);
    --color-popover-foreground: var(--popover-foreground);
    --color-popover: var(--popover);
    --color-card-foreground: var(--card-foreground);
    --color-card: var(--card);
    --color-foreground: var(--foreground);
    --color-background: var(--background);
    --radius-sm: calc(var(--radius) * 0.6);
    --radius-md: calc(var(--radius) * 0.8);
    --radius-lg: var(--radius);
    --radius-xl: calc(var(--radius) * 1.4);
    --radius-2xl: calc(var(--radius) * 1.8);
    --radius-3xl: calc(var(--radius) * 2.2);
    --radius-4xl: calc(var(--radius) * 2.6);
}

:root {
    /* Surfaces */
    --background: #F8FAFC;
    --foreground: #0F172A;
    --card: #FFFFFF;
    --card-foreground: #0F172A;
    --popover: #FFFFFF;
    --popover-foreground: #0F172A;

    /* Brand primary — Onward blue */
    --primary: #2563EB;
    --primary-foreground: #FFFFFF;

    /* Secondary / muted */
    --secondary: #F1F5F9;
    --secondary-foreground: #0F172A;
    --muted: #F1F5F9;
    --muted-foreground: #64748B;

    /* Accent — blue tint (used by shadcn hover states) */
    --accent: #EFF6FF;
    --accent-foreground: #2563EB;

    /* Semantic */
    --destructive: #DC2626;

    /* Borders & inputs */
    --border: #E2E8F0;
    --input: #E2E8F0;
    --ring: #2563EB;

    /* Charts (unchanged) */
    --chart-1: oklch(0.87 0 0);
    --chart-2: oklch(0.556 0 0);
    --chart-3: oklch(0.439 0 0);
    --chart-4: oklch(0.371 0 0);
    --chart-5: oklch(0.269 0 0);

    /* Radius — brand md = 12px */
    --radius: 0.75rem;

    /* Sidebar — Onward navy */
    --sidebar: #0F172A;
    --sidebar-foreground: #FFFFFF;
    --sidebar-primary: #2563EB;
    --sidebar-primary-foreground: #FFFFFF;
    --sidebar-accent: rgba(37, 99, 235, 0.15);
    --sidebar-accent-foreground: #FFFFFF;
    --sidebar-border: rgba(255, 255, 255, 0.06);
    --sidebar-ring: #2563EB;
}

.dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.922 0 0);
    --primary-foreground: oklch(0.205 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.269 0 0);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.556 0 0);
    --chart-1: oklch(0.87 0 0);
    --chart-2: oklch(0.556 0 0);
    --chart-3: oklch(0.439 0 0);
    --chart-4: oklch(0.371 0 0);
    --chart-5: oklch(0.269 0 0);
    --sidebar: oklch(0.205 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: #2563EB;
    --sidebar-primary-foreground: oklch(0.985 0 0);
    --sidebar-accent: oklch(0.269 0 0);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.556 0 0);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
  html {
    @apply font-sans;
  }
}
```

- [ ] **Step 3: Start dev server and verify token changes**

```bash
npm run dev
```

Open `http://localhost:5173`. Check:
- Body font is now Be Vietnam Pro (rounder letters, Vietnamese-optimized strokes)
- Background is slightly blue-tinted white (`#F8FAFC`) instead of pure white
- Any visible `bg-primary` buttons are now `#2563EB` blue (not indigo-purple)

- [ ] **Step 4: Commit**

```bash
git add src/index.css package.json package-lock.json
git commit -m "style: apply Onward brand tokens — Be Vietnam Pro font, blue primary, navy sidebar vars"
```

---

## Task 2: Sidebar Redesign (`AppLayout.tsx`)

**Files:**
- Modify: `src/components/layout/AppLayout.tsx`

**Interfaces:**
- Consumes: `--sidebar: #0F172A` from Task 1 CSS tokens (sidebar bg auto-applies if using `bg-sidebar`, but current code uses inline style — will be replaced with explicit hex)
- Produces: Onward-branded navigation shell that all pages render inside

- [ ] **Step 1: Replace logo section — "FlagFlow" → Onward SVG**

In `AppLayout.tsx`, find the logo block (lines 61–69):
```tsx
{/* Logo */}
<div className="h-16 flex items-center gap-3 px-5 border-b border-white/5">
  <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
    <Flag className="w-4 h-4 text-white" strokeWidth={2.5} />
  </div>
  <div>
    <p className="font-bold text-white leading-none text-[15px]">FlagFlow</p>
    <p className="text-[10px] text-white/30 leading-none mt-0.5 font-medium tracking-wide">FEATURE FLAGS</p>
  </div>
</div>
```

Replace with:
```tsx
{/* Logo */}
<div className="h-16 flex items-center gap-3 px-5 border-b border-white/[0.06]">
  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#2563EB' }}>
    <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
      <path d="M14 44 L28 34 L38 40 L50 22" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M40 22 L50 22 L50 32" stroke="#10B981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
  <div>
    <p className="font-bold text-white leading-none text-[15px]">Onward</p>
    <p className="text-[10px] text-white/35 leading-none mt-0.5 font-semibold tracking-widest">FEATURE FLAGS</p>
  </div>
</div>
```

- [ ] **Step 2: Update sidebar background and content area background**

Find (line 55):
```tsx
<div className="flex h-screen overflow-hidden bg-[#f4f5f7]">
```
Replace with:
```tsx
<div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
```

Find the `<aside>` (line 58):
```tsx
<aside className="w-64 shrink-0 flex flex-col" style={{ background: '#1a1523' }}>
```
Replace with:
```tsx
<aside className="w-64 shrink-0 flex flex-col" style={{ background: '#0F172A' }}>
```

- [ ] **Step 3: Update org switcher org-letter avatar color**

Find (line 79):
```tsx
<div className="w-5 h-5 rounded bg-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
```
Replace with:
```tsx
<div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: '#2563EB' }}>
```

Also find the dropdown item avatar (line 94):
```tsx
<div className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600">
```
Replace with:
```tsx
<div className="w-5 h-5 rounded bg-[#EFF6FF] flex items-center justify-center text-[10px] font-bold text-[#2563EB]">
```

- [ ] **Step 4: Update nav item active states — indigo → brand blue**

Find the active project button classes (lines 123–128):
```tsx
isActive
  ? 'bg-indigo-500/20 text-white border border-indigo-500/30'
  : 'text-white/50 hover:bg-white/5 hover:text-white/80 border border-transparent'
```
Replace with:
```tsx
isActive
  ? 'bg-[#2563EB]/[0.18] text-white border border-[#2563EB]/[0.35]'
  : 'text-white/50 hover:bg-white/5 hover:text-white/80 border border-transparent'
```

Find the active project icon (line 130):
```tsx
<FolderKanban className={cn('w-4 h-4 shrink-0', isActive ? 'text-indigo-400' : 'text-white/30')} />
```
Replace with:
```tsx
<FolderKanban className={cn('w-4 h-4 shrink-0', isActive ? 'text-[#60A5FA]' : 'text-white/30')} />
```

Find the chevron icon (line 132):
```tsx
{isActive && <ChevronRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
```
Replace with:
```tsx
{isActive && <ChevronRight className="w-3.5 h-3.5 text-[#60A5FA] shrink-0" />}
```

- [ ] **Step 5: Update header breadcrumb — Flags badge and border**

Find the header (line 188):
```tsx
<header className="h-14 bg-white border-b border-gray-200 flex items-center px-8 gap-2 shrink-0 shadow-sm">
```
Replace with:
```tsx
<header className="h-14 bg-white border-b border-[#E2E8F0] flex items-center px-8 gap-2 shrink-0 shadow-sm">
```

Find the Flags badge (lines 207–210):
```tsx
<span className="ml-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
```
Replace with:
```tsx
<span className="ml-1 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#2563EB] bg-[#EFF6FF] border border-[#BFDBFE] px-2.5 py-0.5 rounded-full">
```

- [ ] **Step 6: Update user footer avatar**

Find (line 166):
```tsx
<div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
```
Replace with:
```tsx
<div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ background: '#2563EB' }}>
```

- [ ] **Step 7: Remove unused `Flag` import if no longer used**

Check top of file — `Flag` is still used in the breadcrumb badge (line 209), so keep the import.

- [ ] **Step 8: Visual check**

With the dev server running, navigate to any authenticated page. Verify:
- Sidebar is navy (`#0F172A`), not purple-black
- Logo shows "Onward" with the upward-arrow SVG + green accent arrow
- Active nav item highlights in blue, not indigo
- Avatar in footer is brand blue
- Breadcrumb "Flags" badge is blue, not indigo

- [ ] **Step 9: Commit**

```bash
git add src/components/layout/AppLayout.tsx
git commit -m "style: rebrand sidebar to Onward — navy bg, blue active states, Onward SVG logo"
```

---

## Task 3: FlagsPage Brand Alignment (`FlagsPage.tsx`)

**Files:**
- Modify: `src/pages/flags/FlagsPage.tsx`

**Interfaces:**
- Consumes: Brand tokens from Task 1, sidebar shell from Task 2
- Produces: Flags list page with Onward-aligned stats, toggle, table, and archived section

- [ ] **Step 1: Update stats cards array**

Find the stats array (lines 199–201):
```tsx
{ label: 'Total flags', value: activeFlags.length,   color: 'text-gray-900',    accent: 'border-l-slate-300',   icon: <Flag className="w-5 h-5 text-slate-400" />,    bg: 'bg-slate-50'   },
{ label: 'Enabled',     value: enabledCount,           color: 'text-emerald-600', accent: 'border-l-emerald-400', icon: <ToggleRight className="w-5 h-5 text-emerald-500" />, bg: 'bg-emerald-50' },
{ label: 'Archived',    value: archivedFlags.length,   color: 'text-gray-400',    accent: 'border-l-slate-200',   icon: <Archive className="w-5 h-5 text-slate-300" />, bg: 'bg-white'      },
```

Replace with:
```tsx
{ label: 'Total flags', value: activeFlags.length,   color: 'text-[#0F172A]',   accent: 'border-l-[#2563EB]',   icon: <Flag className="w-5 h-5 text-[#2563EB]" />,           bg: 'bg-[#EFF6FF]'  },
{ label: 'Enabled',     value: enabledCount,           color: 'text-[#16A34A]',   accent: 'border-l-[#10B981]',   icon: <ToggleRight className="w-5 h-5 text-[#10B981]" />,     bg: 'bg-[#ECFDF5]'  },
{ label: 'Archived',    value: archivedFlags.length,   color: 'text-[#64748B]',   accent: 'border-l-[#E2E8F0]',   icon: <Archive className="w-5 h-5 text-[#64748B]" />,         bg: 'bg-[#F8FAFC]'  },
```

- [ ] **Step 2: Update FlagToggle pill — emerald → brand green**

Find the toggle button className (lines 56–62):
```tsx
className={cn(
  'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all select-none',
  enabled
    ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm shadow-emerald-200'
    : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
  pending && 'opacity-60 cursor-not-allowed',
)}
```

Replace with:
```tsx
className={cn(
  'inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all select-none',
  enabled
    ? 'bg-[#10B981] text-white hover:bg-[#059669] shadow-sm shadow-[#10B981]/25'
    : 'bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]',
  pending && 'opacity-60 cursor-not-allowed',
)}
```

Also update the inner dot (line 67):
```tsx
<span className={cn('w-2 h-2 rounded-full', enabled ? 'bg-white' : 'bg-slate-400')} />
```
Replace with:
```tsx
<span className={cn('w-2 h-2 rounded-full', enabled ? 'bg-white' : 'bg-[#94A3B8]')} />
```

- [ ] **Step 3: Update table toolbar and table background**

Find the table wrapper (line 217):
```tsx
<div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
```
Replace with:
```tsx
<div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
```

Find the toolbar border (line 220):
```tsx
<div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
```
Replace with:
```tsx
<div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center gap-3">
```

- [ ] **Step 4: Update empty state icon colors**

Find the empty state icon box (lines 255–257):
```tsx
<div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
  <Flag className="w-7 h-7 text-indigo-400" />
</div>
```
Replace with:
```tsx
<div className="w-16 h-16 rounded-2xl bg-[#EFF6FF] flex items-center justify-center mb-4">
  <Flag className="w-7 h-7 text-[#2563EB]" />
</div>
```

Find the "Clear search" button (line 274):
```tsx
<button onClick={() => setSearch('')} className="text-xs text-indigo-600 mt-1 hover:underline">
```
Replace with:
```tsx
<button onClick={() => setSearch('')} className="text-xs text-[#2563EB] mt-1 hover:underline">
```

- [ ] **Step 5: Update table header and row colors**

Find the table header row (lines 283–291):
```tsx
<div className={cn(
  'grid items-center px-5 py-3 bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-400 uppercase tracking-wider',
  envId ? colsWithEnv : colsNoEnv
)}>
```
Replace with:
```tsx
<div className={cn(
  'grid items-center px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] text-[11px] font-bold text-[#64748B] uppercase tracking-wider',
  envId ? colsWithEnv : colsNoEnv
)}>
```

Find the flag row hover (lines 299–303):
```tsx
className={cn(
  'grid items-center px-5 py-4 hover:bg-gray-50/80 transition-colors',
  envId ? colsWithEnv : colsNoEnv
)}
```
Replace with:
```tsx
className={cn(
  'grid items-center px-5 py-4 hover:bg-[#F8FAFC] transition-colors',
  envId ? colsWithEnv : colsNoEnv
)}
```

Find the divide color (line 294):
```tsx
<div className="divide-y divide-gray-100">
```
Replace with:
```tsx
<div className="divide-y divide-[#F1F5F9]">
```

- [ ] **Step 6: Update status dots in table rows**

Find the status dot (lines 309–313):
```tsx
<span className={cn(
  'w-2 h-2 rounded-full shrink-0 transition-colors',
  envId ? (isEnabled ? 'bg-emerald-400' : 'bg-gray-300') : 'bg-indigo-400'
)} />
```
Replace with:
```tsx
<span className={cn(
  'w-2 h-2 rounded-full shrink-0 transition-colors',
  envId ? (isEnabled ? 'bg-[#10B981]' : 'bg-[#CBD5E1]') : 'bg-[#2563EB]'
)} />
```

- [ ] **Step 7: Update action button hover colors**

Find the edit button (lines 340–345):
```tsx
<button
  onClick={() => openEdit(flag)}
  className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors"
  title="Edit"
>
```
Replace with:
```tsx
<button
  onClick={() => openEdit(flag)}
  className="p-1.5 rounded hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#2563EB] transition-colors"
  title="Edit"
>
```

- [ ] **Step 8: Update archived section**

Find the archived wrapper (line 371):
```tsx
<div className="rounded-xl border border-dashed border-gray-200 bg-white overflow-hidden">
```
Replace with:
```tsx
<div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white overflow-hidden">
```

Find the archived collapse button (lines 372–374):
```tsx
<button
  className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium text-gray-400 hover:bg-gray-50 transition-colors"
```
Replace with:
```tsx
<button
  className="w-full flex items-center gap-2 px-5 py-3 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
```

Find the archived count badge (lines 379–381):
```tsx
<span className="ml-1 text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
```
Replace with:
```tsx
<span className="ml-1 text-xs bg-[#F1F5F9] text-[#64748B] px-2 py-0.5 rounded-full">
```

Find the Restore button (lines 403–408):
```tsx
<button
  onClick={() => unarchiveMutation.mutate(flag.id)}
  disabled={unarchiveMutation.isPending}
  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium px-2.5 py-1.5 rounded-lg border border-indigo-100 hover:bg-indigo-50 transition-colors"
>
```
Replace with:
```tsx
<button
  onClick={() => unarchiveMutation.mutate(flag.id)}
  disabled={unarchiveMutation.isPending}
  className="flex items-center gap-1.5 text-xs text-[#2563EB] hover:text-[#1D4ED8] font-medium px-2.5 py-1.5 rounded-lg border border-[#BFDBFE] hover:bg-[#EFF6FF] transition-colors"
>
```

- [ ] **Step 9: Visual check**

Navigate to a Flags page with at least one flag. Verify:
- Stats cards: Total has blue left-border and icon, Enabled has green left-border and icon, Archived has slate
- Enabled toggle pills are `#10B981` green, disabled pills are light grey
- Status dot for enabled flag is `#10B981` green
- Edit icon hover turns `#2563EB` blue (not indigo-purple)
- Restore button border and text are brand blue

- [ ] **Step 10: Commit**

```bash
git add src/pages/flags/FlagsPage.tsx
git commit -m "style: align FlagsPage colors with Onward brand — stats, toggle, table, archived"
```

---

## Task 4: Auth Pages Brand Alignment (Login + Register)

**Files:**
- Modify: `src/pages/auth/LoginPage.tsx`
- Modify: `src/pages/auth/RegisterPage.tsx`

**Interfaces:**
- Consumes: Brand tokens from Task 1
- Produces: Auth pages with Onward brand panel (blue gradient, Onward logo) replacing the current FlagFlow indigo-purple panel

### LoginPage.tsx changes

- [ ] **Step 1: Update brand panel gradient and remove `Flag` icon import if unused after changes**

Find the left panel background inline style (line 43):
```tsx
style={{ background: 'linear-gradient(135deg, #4338ca 0%, #5b21b6 60%, #4c1d95 100%)' }}
```
Replace with:
```tsx
style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
```

- [ ] **Step 2: Replace logo in left panel — FlagFlow → Onward**

Find the logo block inside the left panel (lines 71–76):
```tsx
<div className="relative flex items-center gap-3">
  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
    <Flag className="w-4.5 h-4.5 text-white" />
  </div>
  <span className="text-white font-bold text-xl">FlagFlow</span>
</div>
```
Replace with:
```tsx
<div className="relative flex items-center gap-3">
  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
    <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
      <path d="M14 44 L28 34 L38 40 L50 22" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M40 22 L50 22 L50 32" stroke="#10B981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
  <span className="text-white font-bold text-xl">Onward</span>
</div>
```

- [ ] **Step 3: Update feature list text colors in left panel**

Find (line 85):
```tsx
<li key={i} className="flex items-center gap-3 text-indigo-200 text-sm">
```
Replace with:
```tsx
<li key={i} className="flex items-center gap-3 text-white/80 text-sm">
```

- [ ] **Step 4: Update left panel footer copyright**

Find (line 95):
```tsx
<p className="relative text-indigo-300/50 text-xs">© 2025 FlagFlow · Built for modern teams</p>
```
Replace with:
```tsx
<p className="relative text-white/30 text-xs">© 2026 Onward · Built for modern teams</p>
```

- [ ] **Step 5: Update mobile logo — indigo → brand blue**

Find (lines 102–107):
```tsx
<div className="flex items-center gap-2.5 mb-10 lg:hidden">
  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center">
    <Flag className="w-4 h-4 text-white" />
  </div>
  <span className="font-bold text-gray-900 text-lg">FlagFlow</span>
</div>
```
Replace with:
```tsx
<div className="flex items-center gap-2.5 mb-10 lg:hidden">
  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#2563EB' }}>
    <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
      <path d="M14 44 L28 34 L38 40 L50 22" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M40 22 L50 22 L50 32" stroke="#10B981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
  <span className="font-bold text-gray-900 text-lg">Onward</span>
</div>
```

- [ ] **Step 6: Update form heading and subtitle**

Find (lines 109–110):
```tsx
<h1 className="text-3xl font-bold text-gray-900 mb-1">Welcome back</h1>
<p className="text-gray-500 text-sm mb-8">Sign in to your FlagFlow account.</p>
```
Replace with:
```tsx
<h1 className="text-3xl font-bold text-[#0F172A] mb-1">Welcome back</h1>
<p className="text-[#64748B] text-sm mb-8">Sign in to your Onward account.</p>
```

- [ ] **Step 7: Update submit button text and nav link color**

Find (line 146):
```tsx
{loading ? 'Signing in…' : 'Sign in to FlagFlow'}
```
Replace with:
```tsx
{loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
```

Find the nav link (line 152):
```tsx
<Link to="/register" className="text-indigo-600 font-semibold hover:underline">
```
Replace with:
```tsx
<Link to="/register" className="text-[#2563EB] font-semibold hover:underline">
```

- [ ] **Step 8: Update form background (right panel)**

Find (line 99):
```tsx
<div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
```
Replace with:
```tsx
<div className="flex-1 flex items-center justify-center bg-[#F8FAFC] p-8">
```

- [ ] **Step 9: Remove unused `Flag` import**

Check the top import (line 8):
```tsx
import { Flag, ToggleRight, Zap, ShieldCheck } from 'lucide-react'
```
`Flag` is no longer used in JSX after Steps 2 and 5. Replace with:
```tsx
import { ToggleRight, Zap, ShieldCheck } from 'lucide-react'
```

### RegisterPage.tsx changes

- [ ] **Step 10: Update brand panel gradient**

Find (line 49):
```tsx
style={{ background: 'linear-gradient(135deg, #4338ca 0%, #5b21b6 60%, #4c1d95 100%)' }}
```
Replace with:
```tsx
style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)' }}
```

- [ ] **Step 11: Replace logo in left panel**

Find (lines 55–60):
```tsx
<div className="relative flex items-center gap-3">
  <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
    <Flag className="w-4.5 h-4.5 text-white" />
  </div>
  <span className="text-white font-bold text-xl">FlagFlow</span>
</div>
```
Replace with:
```tsx
<div className="relative flex items-center gap-3">
  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
    <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
      <path d="M14 44 L28 34 L38 40 L50 22" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M40 22 L50 22 L50 32" stroke="#10B981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
  <span className="text-white font-bold text-xl">Onward</span>
</div>
```

- [ ] **Step 12: Update left panel body text and testimonial**

Find (line 67):
```tsx
<p className="text-indigo-200 text-base leading-relaxed max-w-xs">
  FlagFlow gives your team the confidence to ship fast and roll back instantly — without redeployments.
</p>
```
Replace with:
```tsx
<p className="text-white/80 text-base leading-relaxed max-w-xs">
  Onward gives your team the confidence to ship fast and roll back instantly — without redeployments.
</p>
```

Find (line 73):
```tsx
<p className="text-indigo-300 text-[11px]">5000+ flags managed</p>
```
Replace with:
```tsx
<p className="text-white/60 text-[11px]">5000+ flags managed</p>
```

- [ ] **Step 13: Update left panel footer**

Find (line 86):
```tsx
<p className="relative text-indigo-300/50 text-xs">© 2025 FlagFlow · Built for modern teams</p>
```
Replace with:
```tsx
<p className="relative text-white/30 text-xs">© 2026 Onward · Built for modern teams</p>
```

- [ ] **Step 14: Update mobile logo**

Find (lines 93–98):
```tsx
<div className="flex items-center gap-2.5 mb-10 lg:hidden">
  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center">
    <Flag className="w-4 h-4 text-white" />
  </div>
  <span className="font-bold text-gray-900 text-lg">FlagFlow</span>
</div>
```
Replace with:
```tsx
<div className="flex items-center gap-2.5 mb-10 lg:hidden">
  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#2563EB' }}>
    <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
      <path d="M14 44 L28 34 L38 40 L50 22" stroke="white" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M40 22 L50 22 L50 32" stroke="#10B981" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
  <span className="font-bold text-gray-900 text-lg">Onward</span>
</div>
```

- [ ] **Step 15: Update form heading, subtitle, button, and nav link**

Find (lines 100–101):
```tsx
<h1 className="text-3xl font-bold text-gray-900 mb-1">Create your account</h1>
<p className="text-gray-500 text-sm mb-8">Get started for free — no credit card needed.</p>
```
Replace with:
```tsx
<h1 className="text-3xl font-bold text-[#0F172A] mb-1">Create your account</h1>
<p className="text-[#64748B] text-sm mb-8">Get started for free — no credit card needed.</p>
```

Find the button text (line 145):
```tsx
{loading ? 'Creating account…' : 'Get started free'}
```
Replace with:
```tsx
{loading ? 'Đang đăng ký…' : 'Đăng ký'}
```

Find the nav link (line 152):
```tsx
<Link to="/login" className="text-indigo-600 font-semibold hover:underline">
```
Replace with:
```tsx
<Link to="/login" className="text-[#2563EB] font-semibold hover:underline">
```

- [ ] **Step 16: Update form background (right panel)**

Find (line 90):
```tsx
<div className="flex-1 flex items-center justify-center bg-gray-50 p-8">
```
Replace with:
```tsx
<div className="flex-1 flex items-center justify-center bg-[#F8FAFC] p-8">
```

- [ ] **Step 17: Remove unused `Flag` import**

Find (line 9):
```tsx
import { Flag } from 'lucide-react'
```
Remove this import entirely — `Flag` is no longer used after Steps 11 and 14.

- [ ] **Step 18: Visual check**

Open `/login` and `/register`. Verify:
- Left brand panel is now Onward blue gradient (`#2563EB → #1D4ED8`), not purple
- Onward SVG logo (white arrow + green accent) appears top-left of brand panel
- Feature list text is white/80, not indigo-200
- Copyright says "Onward", not "FlagFlow"
- Nav link ("Create one free" / "Sign in") is `#2563EB` blue
- On mobile (resize to <1024px): logo in top-left of form area shows Onward SVG on blue background
- Button text shows "Đăng nhập" / "Đăng ký"

- [ ] **Step 19: Commit**

```bash
git add src/pages/auth/LoginPage.tsx src/pages/auth/RegisterPage.tsx
git commit -m "style: rebrand auth pages to Onward — blue gradient panel, Onward logo, brand colors"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** All 6 items from spec's implementation checklist are covered across 4 tasks. `.dark` class intentionally deferred (noted in spec).
- [x] **No placeholders:** Every step has exact className strings or JSX blocks — no "update appropriately" or TBD.
- [x] **Type consistency:** No cross-task type dependencies (pure styling — no functions or interfaces shared).
- [x] **Scope:** 4 tasks, pure visual changes, no new files.
- [x] **Line references:** All line numbers reference the current file state; each task's steps are ordered so earlier replacements don't shift lines for later steps within the same task.
