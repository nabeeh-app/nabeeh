# Plan 055: Debounce saveCreds DB upsert

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat HEAD -- backend/lib/baileysAuthState.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

`saveCreds` fires a full Supabase upsert on every `creds.update` event. Baileys fires this on key rotations, session changes, and after message processing — potentially dozens of times per minute per active session. At 50 concurrent sessions, this generates hundreds of upserts per minute.

## Current state

- `backend/lib/baileysAuthState.js:147-184`:
  ```js
  saveCreds: async () => {
    try {
      const serialized = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));
      if (teacherId) {
        const { error } = await supabaseAdmin
          .from('whatsapp_auth_creds')
          .upsert({
            teacher_id: teacherId,
            creds: serialized,
            updated_at: new Date().toISOString()
          }, { onConflict: 'teacher_id' });
        // ...
      }
    } catch (err) { ... }
  }
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 235 pass            |

## Scope

**In scope**:
- `backend/lib/baileysAuthState.js` — add debounce to saveCreds

**Out of scope**: No other files

## Steps

### Step 1: Add debounce variable and wrap saveCreds

At the top of `useSupabaseAuthState` (after the `creds` variable declaration), add:

```js
let saveCredsTimer = null;
```

Then replace the `saveCreds` function (lines 147-184) with a debounced version:

```js
saveCreds: async () => {
  // Debounce: coalesce rapid updates, only persist the last one within 3s
  if (saveCredsTimer) clearTimeout(saveCredsTimer);
  saveCredsTimer = setTimeout(async () => {
    try {
      const serialized = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));

      if (teacherId) {
        const { error } = await supabaseAdmin
          .from('whatsapp_auth_creds')
          .upsert({
            teacher_id: teacherId,
            creds: serialized,
            updated_at: new Date().toISOString()
          }, { onConflict: 'teacher_id' });

        if (error) {
          logger.error('saveCreds FAILED (teacher)', { teacherId, error: error.message, code: error.code });
        } else {
          logger.info('saveCreds OK', { teacherId });
        }
      } else {
        const { error } = await supabaseAdmin
          .from('whatsapp_auth_creds')
          .upsert({
            id: 'default',
            creds: serialized,
            updated_at: new Date().toISOString()
          });

        if (error) {
          logger.error('saveCreds FAILED (default)', { error: error.message, code: error.code });
        } else {
          logger.info('saveCreds OK (default)');
        }
      }
    } catch (err) {
      logger.error('saveCreds ERROR', { teacherId, error: err.message });
    }
  }, 3000);
}
```

**Verify**: `cd backend && npm test` → 235 pass

## Done criteria

- [ ] `saveCreds` debounces with 3s trailing delay
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `saveCreds` no longer exists in the auth state
