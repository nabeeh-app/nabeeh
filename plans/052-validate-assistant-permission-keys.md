# Plan 052: Validate assistant permission keys against allowed set

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat HEAD -- backend/routes/assistants.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

The `updatePermissions` route accepts `req.body.permissions` as `z.record(z.string(), z.boolean())` — any key is accepted. A teacher can grant an assistant `manage_grades: true` or arbitrary custom permissions, bypassing the tier-based default permission set defined in `VALID_PERMISSIONS`.

## Current state

- `backend/routes/assistants.js:51-53` — Zod schema:
  ```js
  const updatePermissionsSchema = z.object({
    body: z.object({
      permissions: z.record(z.string(), z.boolean())
    }),
    params: z.object({ id: z.string().uuid() })
  });
  ```
- `backend/routes/assistants.js:30` — valid keys exist:
  ```js
  const VALID_PERMISSIONS = Object.keys(DEFAULT_PERMISSIONS);
  ```
- `backend/routes/assistants.js:401-404` — writes directly:
  ```js
  const { error: updateError } = await supabaseAdmin
    .from('teacher_assistants')
    .update({ permissions, updated_at: new Date().toISOString() })
    .eq('id', id);
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 235 pass            |

## Scope

**In scope**:
- `backend/routes/assistants.js` — filter permissions before upsert

**Out of scope**: No other files

## Steps

### Step 1: Filter permissions in updatePermissions handler

In `backend/routes/assistants.js`, in the `updatePermissions` handler, after `const { permissions } = req.body;` (line 387), add filtering:

```js
// Filter to only valid permission keys
const filteredPermissions = {};
for (const key of VALID_PERMISSIONS) {
  if (key in permissions) {
    filteredPermissions[key] = Boolean(permissions[key]);
  }
}
```

Then change line 403 from `{ permissions, ... }` to `{ permissions: filteredPermissions, ... }`:

```js
const { error: updateError } = await supabaseAdmin
  .from('teacher_assistants')
  .update({ permissions: filteredPermissions, updated_at: new Date().toISOString() })
  .eq('id', id);
```

**Verify**: `cd backend && npm test` → 235 pass

## Done criteria

- [ ] Permissions are filtered against `VALID_PERMISSIONS` before database write
- [ ] Unknown keys are silently dropped (not rejected — teacher may omit keys)
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `VALID_PERMISSIONS` no longer exists
