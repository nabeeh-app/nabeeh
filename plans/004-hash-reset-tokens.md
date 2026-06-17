# Plan 004: Hash password reset tokens at rest

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b52b9d0..HEAD -- backend/routes/auth.js backend/lib/auth.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `b52b9d0`, 2026-06-17
- **Issue**: —

## Why this matters

Password reset tokens are stored as plaintext in the `password_reset_tokens` table (`backend/routes/auth.js:1156-1162`). If the database is compromised (SQL injection, backup leak, insider threat), every unused reset token is immediately usable — an attacker can reset any teacher's password. Hashing tokens at rest (like we hash passwords) means a DB leak doesn't directly yield usable tokens.

## Current state

**Token generation** (`backend/routes/auth.js:1152`):
```js
const resetToken = authService.tokenService.generateResetToken();
```

**Token storage** (`backend/routes/auth.js:1156-1162`):
```js
const { error } = await supabaseAdmin
  .from('password_reset_tokens')
  .insert({
    teacher_id: user.id,
    token: resetToken,           // <-- stored as plaintext
    expires_at: expiresAt.toISOString()
  });
```

**Token validation** (`backend/routes/auth.js:1250-1254`):
```js
const { data: resetToken, error } = await supabaseAdmin
  .from('password_reset_tokens')
  .select('id, teacher_id, expires_at, used')
  .eq('token', token)            // <-- lookup by plaintext
  .single();
```

**Same pattern in reset-password** (`backend/routes/auth.js:1371-1375`):
```js
const { data: resetToken, error } = await supabaseAdmin
  .from('password_reset_tokens')
  .select('id, teacher_id, expires_at, used')
  .eq('token', token)
  .single();
```

**Token generation** (`backend/lib/auth.js:56-58`):
```js
generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}
```

## Approach

Use SHA-256 hashing (via Node.js `crypto`):
1. When generating a token, store `sha256(token)` in the database
2. When validating, hash the user-supplied token and compare against the stored hash
3. The plaintext token is only ever sent to the user via email — never stored

This is the same pattern used by industry-standard password reset (e.g., GitHub, Auth0).

## Commands you will need

| Purpose    | Command                                          | Expected on success          |
|------------|--------------------------------------------------|------------------------------|
| Tests      | `cd backend && npm test`                         | all pass                     |

## Scope

**In scope** (the only files you should modify):
- `backend/lib/auth.js` — add `hashToken(token)` method to `TokenService`
- `backend/routes/auth.js` — hash before storing, hash before lookup

**Out of scope**:
- `frontend/` — no changes
- `database/migrations/` — no schema change needed; the `token` column stays as `TEXT`; we just store a different value

## Git workflow

- Branch: `advisor/004-hash-reset-tokens`
- Conventional commit: `security(auth): hash password reset tokens at rest`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `hashToken` method to `TokenService`

Edit `backend/lib/auth.js`, add to the `TokenService` class (after `generateResetToken`):

```js
/**
 * Hash a token using SHA-256 for secure storage
 * @param {string} token - Plain token
 * @returns {string} - Hex-encoded SHA-256 hash
 */
hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
```

**Verify**: `grep -n "hashToken" backend/lib/auth.js` → found

### Step 2: Hash token before storing in `request-reset`

Edit `backend/routes/auth.js`, in the `request-reset` handler (around line 1152-1162):

Change:
```js
const resetToken = authService.tokenService.generateResetToken();
```
to:
```js
const resetTokenPlain = authService.tokenService.generateResetToken();
const resetToken = authService.tokenService.hashToken(resetTokenPlain);
```

And update the email link to use the **plain** token (the user needs the original to reset):
```js
const resetLink = `${frontendUrl}/reset-password?token=${resetTokenPlain}`;
```

And update the log entry to NOT log the token value:
```js
logger.info('Password reset requested', { email });
// Remove: logger.info logs the email only, not the token — this is already safe
```

**Verify**: `grep -n "resetTokenPlain\|hashToken" backend/routes/auth.js` → found

### Step 3: Hash token before lookup in `GET /reset/:token`

Edit `backend/routes/auth.js`, in the `GET /reset/:token` handler (around line 1250):

Change:
```js
const { data: resetToken, error } = await supabaseAdmin
  .from('password_reset_tokens')
  .select('id, teacher_id, expires_at, used')
  .eq('token', token)
  .single();
```
to:
```js
const hashedToken = authService.tokenService.hashToken(token);
const { data: resetToken, error } = await supabaseAdmin
  .from('password_reset_tokens')
  .select('id, teacher_id, expires_at, used')
  .eq('token', hashedToken)
  .single();
```

**Verify**: `grep -n "hashedToken" backend/routes/auth.js` → found

### Step 4: Hash token before lookup in `POST /reset-password`

Edit `backend/routes/auth.js`, in the `POST /reset-password` handler (around line 1371):

Change:
```js
const { data: resetToken, error } = await supabaseAdmin
  .from('password_reset_tokens')
  .select('id, teacher_id, expires_at, used')
  .eq('token', token)
  .single();
```
to:
```js
const hashedToken = authService.tokenService.hashToken(token);
const { data: resetToken, error } = await supabaseAdmin
  .from('password_reset_tokens')
  .select('id, teacher_id, expires_at, used')
  .eq('token', hashedToken)
  .single();
```

**Verify**: `grep -n "hashedToken" backend/routes/auth.js` → found 2 matches (GET and POST)

### Step 5: Run tests

```bash
cd backend && npm test
```

**Verify**: All tests pass. Note: existing tests use mocks for the database, so they won't break from this change.

## Test plan

Create `backend/routes/__tests__/hash-reset-tokens.spec.js`:

- Test that `TokenService.hashToken('test')` returns a consistent SHA-256 hash
- Test that `TokenService.hashToken('test')` is different from `TokenService.hashToken('test2')`
- Test that `request-reset` stores the hashed token in the DB (mock Supabase insert, verify the `token` field is a 64-char hex string, not the raw token)
- Test that `GET /reset/:token` hashes the input before querying (mock Supabase select, verify the query uses the hash)
- Test that the email link contains the plain token (mock sendEmail, verify the URL)

Pattern: follow `backend/routes/__tests__/auth.spec.js` for mocking style.

**Verify**: `cd backend && npm test -- hash-reset-tokens` → all pass

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `cd backend && npm test` exits 0
- [ ] `grep -n "hashToken" backend/lib/auth.js` finds the method definition
- [ ] `grep -n "resetTokenPlain" backend/routes/auth.js` finds the plain token variable
- [ ] `grep -n "hashedToken" backend/routes/auth.js` finds 2 matches (GET + POST reset)
- [ ] `grep -n "hashToken(resetTokenPlain)" backend/routes/auth.js` → NOT found (we hash for storage, not for the email link)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts
  (the codebase has drifted since this plan was written).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
- Existing reset tokens in the database need migration (they won't match new hashes). If this is a concern, note it as a follow-up: "existing plaintext tokens are invalid after deployment; users must request new resets."

## Maintenance notes

- **Existing tokens**: After deployment, any outstanding reset tokens (requested but not yet used) will fail to validate because they're stored as plaintext but the code now expects hashes. This is acceptable — reset tokens expire in 1 hour, so the blast radius is small. If needed, add a one-time migration that hashes existing tokens.
- **Token format**: `crypto.randomBytes(32).toString('hex')` produces a 64-char hex string. SHA-256 of that produces a 64-char hex hash. Both are stored in the same `TEXT` column — no schema change needed.
- **Algorithm choice**: SHA-256 is appropriate here because reset tokens have high entropy (128 bits from `randomBytes(32)`). We're not worried about brute-force — we're protecting against DB compromise where the attacker doesn't have the original token.
