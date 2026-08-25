# Plan: Rename Prior/Post → Pre-alert / Arrival & Clearance

## Changes Required

### 1. `src/components/layout/nav-config.ts`
- `NAV_SECTIONS`: `"PRIOR"` → `"PRE-ALERT"`, `"POST"` → `"ARRIVAL & CLEARANCE"`
- NavItem label `"Post Dashboard"` → `"Arrival Dashboard"`
- Move Calls nav item: `section: "post"` → `section: "all"` (keep in same position or append to ALL section)
- Keep section keys (`prior`, `post`, `all`, `admin`) unchanged — only display labels

### 2. `src/app/(app)/dashboard/page.tsx`
- Card heading: `"Prior Operations"` → `"Pre-alert Operations"`
- Card heading: `"Post Operations"` → `"Arrival & Clearance"`
- Variable names remain unchanged (`priorActive`, `postActive`)

### 3. `src/app/(app)/dashboard/prior/page.tsx`
- H1 title (line 388): `"Prior Dashboard"` → `"Pre-alert Dashboard"`

### 4. `src/app/(app)/dashboard/post/page.tsx`
- H1 title (line 165): `"Post Dashboard"` → `"Arrival & Clearance Dashboard"`
- Subtitle (line 167): `"Post-arrival operations overview"` → `"Arrival & Clearance overview"`
- Tooltip (line 182): `"Total Post Cases"` → `"Total Arrival Cases"`
- Tooltip (line 248): `"post-arrival cargo arrival notice"` → `"arrival cargo arrival notice"`
- Section heading (line 276): `"Recent Post-Arrival Cases"` → `"Recent Arrival Cases"`
- Leave `/cases?phase=post` link unchanged (internal filter value)

### 5. `src/app/(app)/cases/page.tsx`
- `PHASE_FILTER_OPTIONS` (lines 53-58):
  - `"Prior (pre-alert)"` → `"Pre-alert"`
  - `"Post (post-arrival)"` → `"Arrival"`
  - `"TP Hold"` → leave as-is
- `applyPhaseFilter` function: keep filter values (`prior`, `post`, `hold`) unchanged — only display labels

### 6. `src/app/(app)/batches/page.tsx`
- Subtitle (line 48): `"All batch runs across Prior and Post workflows."` → `"All batch runs across Pre-alert and Arrival workflows."`
- Phase tab labels remain unchanged (already say Pre-alert / Post-arrival / TP Hold)

### 7. Verify build
- Run `npx tsc --noEmit` to confirm 0 errors

## What's NOT Changing
- Route paths (`/dashboard/prior`, `/dashboard/post`, etc.)
- DB enum values (`pre_alert`, `post_arrival`, `tp_hold`)
- Nav section keys (`prior`, `post`, `all`, `admin`)
- Any business logic or query behavior
- Batch phase filter values or phase badge labels
