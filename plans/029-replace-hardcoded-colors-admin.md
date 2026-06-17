# Plan 029: Replace hardcoded colors with design system CSS variables

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- admin/app/dashboard/layout.tsx admin/app/dashboard/page.tsx admin/app/dashboard/*/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `2e8fb57`, 2026-06-16

## Why this matters

The dashboard layout and pages use hardcoded hex colors (`#083d44`, `#fcfcf8`, `#e5ff97`, etc.) in inline styles instead of the CSS variables defined in `globals.css`. This makes theming impossible, creates maintenance burden, and is inconsistent with the main Nabeeh frontend which uses CSS variables throughout (AGENTS.md §9: "Use CSS variables, NOT hardcoded text-blue-600").

## Current state

Design tokens in `admin/app/globals.css:115-139`:
```css
:root {
  --ink: #083d44;
  --ink-deep: #09272b;
  --canvas: #fcfcf8;
  --surface-sage: #f3f6e4;
  --surface-cool: #e8eced;
  --primary: #026370;
  --accent: #e5ff97;
  --destructive: #c53030;
  --success: #16a34a;
  --warning: #ca8a04;
}
```

Hardcoded colors in `admin/app/dashboard/layout.tsx`:
- Line 62: `backgroundColor: '#083d44'` → `var(--ink)`
- Line 63: `borderRight: '1px solid #026370'` → `var(--primary)`
- Line 65: `borderBottom: '1px solid #026370'` → `var(--primary)`
- Line 75: `color: '#fcfcf8'` → `var(--canvas)`
- Line 93: `backgroundColor: isActive ? 'rgba(229,255,151,0.2)' : 'transparent'` → use accent with opacity
- Line 94: `color: isActive ? '#e5ff97' : 'rgba(252,252,248,0.7)'` → use accent/canvas vars
- Line 109: `backgroundColor: 'rgba(229,255,151,0.1)'` → use accent with opacity
- Line 110: `color: '#e5ff97'` → `var(--accent)`
- Line 114: `color: '#fcfcf8'` → `var(--canvas)`
- Line 115: `color: '#e5ff97'` → `var(--accent)`
- Line 122: `color: 'rgba(252,252,248,0.7)'` → use canvas with opacity
- Line 133: `backgroundColor: '#fcfcf8'` → `var(--canvas)`
- Line 137: `backgroundColor: '#083d44'` → `var(--ink)`
- Line 138: `color: '#fcfcf8'` → `var(--canvas)`

Hardcoded colors in `admin/app/dashboard/page.tsx`:
- Line 47: `borderColor: '#083d44'` → `var(--ink)`
- Line 48: `color: 'rgba(8,61,68,0.7)'` → use ink with opacity
- Line 55: `color: '#c53030'` → `var(--destructive)`
- Line 60: `color: '#083d44'` → `var(--ink)`
- Line 73: `color: '#083d44'` → `var(--ink)`
- Line 74: `color: 'rgba(8,61,68,0.6)'` → use ink with opacity

Also in other dashboard pages (teachers, payments, ai-usage, health, tickets) — similar hardcoded patterns in stat badges and status indicators.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Lint      | `cd admin && npm run lint`           | exit 0              |
| Build     | `cd admin && npm run build`          | exit 0              |

## Scope

**In scope**:
- `admin/app/dashboard/layout.tsx`
- `admin/app/dashboard/page.tsx`
- `admin/app/dashboard/teachers/page.tsx`
- `admin/app/dashboard/teachers/[id]/page.tsx`
- `admin/app/dashboard/payments/page.tsx`
- `admin/app/dashboard/ai-usage/page.tsx`
- `admin/app/dashboard/health/page.tsx`
- `admin/app/dashboard/tickets/page.tsx`
- `admin/app/dashboard/tickets/[id]/page.tsx`

**Out of scope**:
- `admin/app/globals.css` — tokens already defined correctly
- `admin/app/login/page.tsx` — already uses Tailwind classes like `text-ink`, `bg-canvas`
- Backend or frontend/ (separate codebase)

## Steps

### Step 1: Update dashboard layout.tsx

Replace all hardcoded hex colors with CSS variable references using `var()` syntax in inline styles.

Key replacements:
- `'#083d44'` → `'var(--ink)'`
- `'#fcfcf8'` → `'var(--canvas)'`
- `'#026370'` → `'var(--primary)'`
- `'#e5ff97'` → `'var(--accent)'`
- `'rgba(229,255,151,0.2)'` → `'rgba(229,255,151,0.2)'` (keep as-is since CSS var doesn't work in rgba directly — OR use Tailwind classes instead)
- `'rgba(252,252,248,0.7)'` → `'rgba(252,252,248,0.7)'` (same)

**Note**: For `rgba()` with CSS variables, use the Tailwind class approach instead of inline styles where possible. For example, `className="bg-ink/20"` instead of `style={{ backgroundColor: 'rgba(8,61,68,0.2)' }}`.

For the sidebar, since it uses extensive inline styles, convert the color values to CSS variables:
```ts
style={{ backgroundColor: 'var(--ink)', borderRight: '1px solid var(--primary)' }}
```

For opacity-based colors, keep the rgba syntax but use CSS variable-derived values:
```ts
style={{ color: 'color-mix(in srgb, var(--accent) 70%, transparent)' }}
```

Or better: convert to Tailwind utility classes where feasible.

**Verify**: `grep -n "'#083d44'" admin/app/dashboard/layout.tsx` → no matches
**Verify**: `grep -n "'#fcfcf8'" admin/app/dashboard/layout.tsx` → no matches

### Step 2: Update dashboard page.tsx

Replace hardcoded colors in stat config and JSX:
- Line 47: `borderColor: '#083d44'` → `borderColor: 'var(--ink)'`
- Line 48: keep rgba as-is (derived from ink)
- Line 55: `color: '#c53030'` → `color: 'var(--destructive)'`
- Line 60: `color: '#083d44'` → `color: 'var(--ink)'`
- Lines 73-74: replace with CSS vars

**Verify**: `grep -n "'#083d44'" admin/app/dashboard/page.tsx` → no matches
**Verify**: `grep -n "'#c53030'" admin/app/dashboard/page.tsx` → no matches

### Step 3: Update teachers/page.tsx status badges

Replace hardcoded color conditionals with Tailwind classes or CSS vars. The status badge styling at lines 135-148 uses hardcoded colors in template literals — convert to use the design token classes.

Example pattern:
```tsx
// Before
className={`... ${t.tier === 'pro' ? 'bg-primary/10 text-primary' : ...}`}

// After (keep as-is — these already use Tailwind classes with token names)
```

Actually, the teachers page already uses Tailwind classes like `bg-primary/10 text-primary` — these map to the CSS variables. Verify no hardcoded hex remains.

**Verify**: `grep -n "'#" admin/app/dashboard/teachers/page.tsx` → no matches

### Step 4: Update remaining dashboard pages

Apply the same pattern to:
- `admin/app/dashboard/teachers/[id]/page.tsx`
- `admin/app/dashboard/payments/page.tsx`
- `admin/app/dashboard/ai-usage/page.tsx`
- `admin/app/dashboard/health/page.tsx`
- `admin/app/dashboard/tickets/page.tsx`
- `admin/app/dashboard/tickets/[id]/page.tsx`

For each file, search for hardcoded hex colors and replace with CSS vars or Tailwind classes.

**Verify**: `grep -rn "'#" admin/app/dashboard/` → no matches (excluding node_modules)

### Step 5: Verify build passes

```bash
cd admin && npm run build
```

Expected: build succeeds with no visual regressions (colors should look identical since the values are the same).

## Test plan

- Visual inspection: all pages should look identical before and after
- Check that sidebar background is still ink (#083d44)
- Check that accent buttons are still accent (#e5ff97)
- Check that status badges still show correct colors

## Done criteria

- [ ] `npm run lint` exits 0 in `admin/`
- [ ] `npm run build` exits 0 in `admin/`
- [ ] `grep -rn "'#" admin/app/dashboard/` returns no matches
- [ ] No hardcoded hex colors in any dashboard page inline styles
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts
- A step's verification fails twice after a reasonable fix attempt
- The visual appearance changes (colors look different)

## Maintenance notes

- Future components should use Tailwind utility classes with token names (`text-ink`, `bg-canvas`, `bg-primary/10`) instead of inline styles
- If a new color is needed, add it to `globals.css` `:root` and `@theme inline` sections first
- The login page already follows the correct pattern — use it as a reference
