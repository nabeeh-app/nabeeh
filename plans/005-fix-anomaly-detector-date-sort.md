# Plan 005: Fix date sort NaN in anomaly detector

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 6f7019f..HEAD -- backend/lib/anomalyDetector.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6f7019f`, 2026-06-14

## Why this matters

The consecutive-absence detection sorts dates using `(sessionB?.date || 0) - (sessionA?.date || 0)` where `date` is a Supabase ISO date string like `"2024-01-15"`. String subtraction produces `NaN`, making the sort comparator return `NaN` — resulting in undefined sort behavior. Consecutive absences may be miscounted, causing missed critical anomaly alerts.

## Current state

- `backend/lib/anomalyDetector.js:57-61` — the broken sort comparator

```js
const sortedByDate = [...attendanceData].sort((a, b) => {
  const sessionA = sessions.find(s => s.id === a.session_id);
  const sessionB = sessions.find(s => s.id === b.session_id);
  return (sessionB?.date || 0) - (sessionA?.date || 0);
});
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `cd backend && node -c lib/anomalyDetector.js` | exit 0 |

## Scope

**In scope**:
- `backend/lib/anomalyDetector.js`

## Steps

### Step 1: Replace string subtraction with proper date comparison

At `anomalyDetector.js:60`, change:

```js
// Change:
return (sessionB?.date || 0) - (sessionA?.date || 0);
// To:
return (sessionB?.date || '').localeCompare(sessionA?.date || '');
```

`localeCompare` works correctly on ISO date strings and sorts newest-first (descending) when B is compared to A.

**Verify**: `cd backend && node -c lib/anomalyDetector.js` → exit 0

## Test plan

- Verify the sort works: `["2024-01-15", "2024-01-10", "2024-01-20"].sort((a,b) => b.localeCompare(a))` → `["2024-01-20", "2024-01-15", "2024-01-10"]`

## Done criteria

- [ ] `cd backend && node -c lib/anomalyDetector.js` exits 0
- [ ] Date sort produces correct order (not NaN)
- [ ] `plans/README.md` status row updated

## STOP conditions

- The `date` field is not a string (confirm by checking a sample session record)
