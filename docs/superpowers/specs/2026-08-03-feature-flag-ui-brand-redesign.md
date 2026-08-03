# Feature Flag UI — Brand Redesign Spec

**Date:** 2026-08-03
**Approach:** Brand-Aligned Redesign (Hướng B)
**Status:** Approved — ready for implementation

---

## Context

UI hiện tại ("FlagFlow") dùng dark sidebar màu `#1a1523` với indigo accent, font Geist Variable — không khớp với brand guide của Onward. Mục tiêu redesign là align toàn bộ design tokens, font, branding sang hệ thống Onward mà không thay đổi layout hay structure.

**Người dùng:** Cả dev và non-dev (admin/business user) trong team Onward.

---

## 1. Design Tokens

### 1.1 CSS Custom Properties (`src/index.css`)

Ánh xạ brand guide → shadcn token system:

```css
:root {
  /* Brand colors → shadcn tokens */
  --primary: #2563EB;
  --primary-foreground: #FFFFFF;
  --background: #F8FAFC;
  --foreground: #0F172A;
  --muted-foreground: #64748B;
  --border: #E2E8F0;
  --input: #E2E8F0;
  --ring: #2563EB;
  --destructive: #DC2626;

  /* Sidebar tokens */
  --sidebar: #0F172A;
  --sidebar-foreground: #FFFFFF;
  --sidebar-primary: #2563EB;
  --sidebar-accent: rgba(37, 99, 235, 0.15);
  --sidebar-border: rgba(255, 255, 255, 0.06);

  /* Base radius → 12px (brand md) */
  --radius: 0.75rem;

  /* Brand-specific (không có trong shadcn) */
  --brand-accent: #10B981;   /* green — tín hiệu tích cực, không dùng cho nút hành động */
  --brand-success: #16A34A;
  --brand-warning: #F59E0B;
}
```

### 1.2 Font

- **Cũ:** Geist Variable (`@fontsource-variable/geist`)
- **Mới:** Be Vietnam Pro (`@fontsource-variable/be-vietnam-pro` hoặc Google Fonts)

```css
--font-sans: 'Be Vietnam Pro', Inter, system-ui, sans-serif;
```

Cần install: `npm install @fontsource-variable/be-vietnam-pro`
Và đổi import trong `index.css`:
```css
@import "@fontsource-variable/be-vietnam-pro";
```

### 1.3 Typography Scale

| Role | Size | Weight | Dùng ở |
|---|---|---|---|
| Display | 32px / 700 | Bold | Số lớn (stats) |
| H1 | 24px / 700 | Bold | Page title |
| H2 | 20px / 600 | SemiBold | Section heading |
| Body | 16px / 400 | Regular | Nội dung chính |
| Caption | 13px / 400 | Regular | Meta, helper text |
| Label | 11px / 700 | Bold + uppercase | Table header, tag |

### 1.4 Spacing & Radius

Hệ spacing giữ nguyên Tailwind 4/8/12/16/24/32. Radius:

| Token | Giá trị | Dùng ở |
|---|---|---|
| `rounded-sm` (7.2px) | ~8px | Input, small badge |
| `rounded-md` (9.6px) | ~10px | Button nhỏ |
| `rounded-lg` (12px) | 12px | Button chính, card nội |
| `rounded-xl` (16.8px) | ~17px | Card lớn, dialog |
| `rounded-full` | — | Avatar, pill, toggle |

---

## 2. Sidebar (`AppLayout.tsx`)

### 2.1 Background & Tones

| Element | Giá trị |
|---|---|
| Sidebar background | `#0F172A` (navy — brand text color) |
| Divider borders | `rgba(255,255,255,0.06)` |
| Section label (WORKSPACE, PROJECTS) | `rgba(255,255,255,0.30)` uppercase 10px/700 |

### 2.2 Logo / Branding

Thay "FlagFlow" + Flag icon bằng Onward identity:

```jsx
<div className="h-16 flex items-center gap-3 px-5 border-b border-white/[0.06]">
  {/* Onward logo icon */}
  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
       style={{ background: '#2563EB' }}>
    <svg width="40" height="40" viewBox="0 0 64 64">
      <path d="M14 44 L28 34 L38 40 L50 22"
            fill="none" stroke="#fff" strokeWidth="4.5"
            strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M40 22 L50 22 L50 32"
            fill="none" stroke="#10B981" strokeWidth="4.5"
            strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </div>
  <div>
    <p className="font-bold text-white leading-none text-[15px]">Onward</p>
    <p className="text-[10px] text-white/35 leading-none mt-0.5 font-semibold tracking-widest">
      FEATURE FLAGS
    </p>
  </div>
</div>
```

### 2.3 Nav Item States

```
Active:
  bg:     rgba(37, 99, 235, 0.18)
  border: 1px solid rgba(37, 99, 235, 0.35)
  text:   #FFFFFF
  icon:   #60A5FA (blue-400)
  chevron: #60A5FA

Inactive:
  text:       rgba(255,255,255,0.45)
  hover text: rgba(255,255,255,0.80)
  hover bg:   rgba(255,255,255,0.05)
```

### 2.4 Environment Dots

Giữ nguyên màu semantic (không phải brand color):
- production → `bg-rose-500`
- staging → `bg-amber-400`
- dev → `bg-emerald-400`
- other → `bg-sky-400`

### 2.5 User Footer

- Avatar background: `#2563EB` (thay `indigo-500`)
- Email text: `rgba(255,255,255,0.80)` 12px/600
- Role text: `rgba(255,255,255,0.30)` 10px/500

---

## 3. App Shell

### 3.1 Header / Breadcrumb

| Element | Giá trị |
|---|---|
| Background | `#FFFFFF` |
| Border bottom | `1px solid #E2E8F0` |
| Breadcrumb text | `#64748B` 14px/500 |
| Breadcrumb hover | `#0F172A` |
| Active crumb | `#0F172A` 14px/600 |
| Flags badge | `color: #2563EB`, `bg: #EFF6FF`, `border: #BFDBFE` |

### 3.2 Content Area

- Background: `#F8FAFC` (brand bg)
- Padding: `p-8` (giữ nguyên)

---

## 4. FlagsPage

### 4.1 Stats Cards

```
Total flags:
  border-left: #2563EB    icon bg: #EFF6FF    icon color: #2563EB
  count color: #0F172A    count size: 36px/700

Enabled:
  border-left: #10B981    icon bg: #ECFDF5    icon color: #10B981
  count color: #16A34A    count size: 36px/700

Archived:
  border-left: #E2E8F0    icon bg: #F8FAFC    icon color: #64748B
  count color: #64748B    count size: 36px/700
```

### 4.2 Flag Table

| Element | Giá trị |
|---|---|
| Row hover | `#F8FAFC` |
| Status dot — enabled | `#10B981` |
| Status dot — disabled | `#CBD5E1` |
| Status dot — no env | `#2563EB` |
| Flag name | `#0F172A` 14px/600 |
| Description | `#64748B` 13px/400 |
| Key badge bg | `#F1F5F9` |
| Key badge text | `#0F172A` 12px mono |
| Edit icon hover | `#2563EB` |
| Archive icon hover | `#F59E0B` |

### 4.3 Type Badges

Giữ nguyên màu semantic — đây là màu phân loại kỹ thuật, không phải brand:
- BOOLEAN → indigo
- STRING → emerald
- INTEGER → orange
- JSON → purple

### 4.4 FlagToggle Pill

```
Enabled:
  bg: #10B981    text: white    hover: #059669
  shadow: 0 1px 4px rgba(16,185,129,0.25)
  dot: white

Disabled:
  bg: #F1F5F9    text: #64748B    hover bg: #E2E8F0
  dot: #94A3B8
```

### 4.5 Archived Section

- Border dashed: `#E2E8F0`
- Collapse button text: `#64748B`
- Count badge: `bg: #F1F5F9`, `text: #64748B`
- Restore button: `text: #2563EB`, `border: #BFDBFE`, `hover bg: #EFF6FF`

---

## 5. Auth Pages (Login / Register)

### 5.1 Layout

```
Page background: #F8FAFC
Card max-width: 420px, centered (vertical + horizontal)
Card structure:
  ┌── Gradient header (radius 16px 16px 0 0) ──┐
  │   Logo + brand name + subtitle              │
  └─────────────────────────────────────────────┘
  ┌── White form area (radius 0 0 16px 16px) ───┐
  │   Form fields + submit button + nav link    │
  └─────────────────────────────────────────────┘
```

### 5.2 Gradient Header

```css
background: linear-gradient(135deg, #2563EB, #1D4ED8);
border-radius: 16px 16px 0 0;
padding: 28px 26px;
```

Nội dung:
- Logo icon: 40×40, `border-radius: 12px`, `bg: rgba(255,255,255,0.15)`
- Onward SVG (white stroke + green accent)
- "Onward" — 20px/700 white
- Subtitle — 13px/400 `rgba(255,255,255,0.80)`
  - Login: "Quản lý feature flags"
  - Register: "Tạo tài khoản mới"

### 5.3 Form Card

```css
background: #FFFFFF;
border: 1px solid #E2E8F0;
border-radius: 0 0 16px 16px;
padding: 28px;
box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
```

### 5.4 Form Fields

- Label: 14px/600 `#0F172A`
- Input height: 44px, radius 8px
- Input border: `#E2E8F0`, focus ring `#2563EB`
- Helper / link: `#2563EB` 13px

### 5.5 Submit Button

- Background: `#2563EB`, hover: `#1D4ED8`
- Full width, height 44px, radius 12px
- Font: 15px/600, white
- Loading state text: "Đang đăng nhập…" / "Đang đăng ký…"

---

## 6. Implementation Checklist

- [ ] Install `@fontsource-variable/be-vietnam-pro`
- [ ] Update `src/index.css` — font import, CSS custom properties (`:root`, `.dark`, sidebar tokens)
- [ ] Update `AppLayout.tsx` — sidebar bg, logo/branding, nav active states, avatar color
- [ ] Update `FlagsPage.tsx` — stats cards, table colors, FlagToggle pill, archived section
- [ ] Update `LoginPage.tsx` — gradient header card + form card layout
- [ ] Update `RegisterPage.tsx` — same structure as Login
- [ ] Remove `@fontsource-variable/geist` import (giữ package nếu cần, chỉ xóa import)
- [ ] Visual QA: kiểm tra các trang không bị vỡ layout sau khi đổi font và radius
- [ ] Lưu ý: `.dark` class tokens chưa được update trong spec này — UI hiện không có dark mode toggle nên để lại cho sprint sau nếu cần
