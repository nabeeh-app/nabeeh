# Plan 060: Fix clearSession legacy path that wipes all teacher auth keys

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat d760576..HEAD -- backend/lib/baileys.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: HIGH
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `d760576`, 2026-06-18

## Why this matters

When `teacherId` is `'default'` or falsy, `clearSession()` runs `.neq('type', '__none__')` which deletes every row in `whatsapp_auth_keys` across all teachers. A single misconfigured teacher ID can nuke all WhatsApp sessions.

## Current state

- `backend/lib/baileys.js:227-238`:
  ```js
  async clearSession() {
    try {
      if (this.teacherId && this.teacherId !== 'default') {
        await supabaseAdmin.from('whatsapp_auth_keys').delete().eq('teacher_id', this.teacherId);
        await supabaseAdmin.from('whatsapp_auth_creds').delete().eq('teacher_id', this.teacherId);
      } else {
        // Legacy: delete default
        await supabaseAdmin.from('whatsapp_auth_keys').delete().neq('type', '__none__');
        await supabaseAdmin.from('whatsapp_auth_creds').delete().eq('id', 'default');
      }
    } catch (err) { ... }
  }
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 244 pass            |

## Scope

**In scope**:
- `backend/lib/baileys.js` — remove legacy fallback or scope it

**Out of scope**: No other files

## Steps

### Step 1: Remove the legacy `'default'` fallback

In `backend/lib/baileys.js`, replace the `clearSession` method to always use teacher-scoped deletes. If `teacherId` is missing or `'default'`, refuse to clear (log a warning and return early):

```js
async clearSession() {
  try {
    if (!this.teacherId || this.teacherId === 'default') {
      logger.warn('Refusing to clear session without valid teacherId', { teacherId: this.teacherId });
      return;
    }
    await supabaseAdmin.from('whatsapp_auth_keys').delete().eq('teacher_id', this.teacherId);
    await supabaseAdmin.from('whatsapp_auth_creds').delete().eq('teacher_id', this.teacherId);
  } catch (err) {
    logger.warn('Error clearing auth state', { teacherId: this.teacherId, error: err.message });
  }
  this.qrCode = null;
}
```

**Verify**: `cd backend && npm test` → 244 pass

## Done criteria

- [ ] `clearSession` never runs an unscoped delete
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `clearSession` no longer exists
