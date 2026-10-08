# Turnstile activation runbook (registration captcha)

Goal: registration rejects bots in production, real users unaffected.
Status: code committed, NOT active until the steps below run in order.

## Why order matters

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is baked into the frontend at BUILD time,
not read at runtime. Setting it without a rebuild changes nothing. The
backend secret is runtime, so backend needs only a restart.

## Step 1. Set env values (Render dashboard, both services)

Backend service (`nabeeh-api`):
- `TURNSTILE_SECRET_KEY` = the Turnstile secret for widget `nabeeh-register`.
  Never commit it, never print it, never put it in `frontend/` env.

Frontend service (`nabeeh-app`):
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = sitekey of widget `nabeeh-register`.
  Public by design (it ships in page HTML).

## Step 2. Deploy backend first, then frontend

1. Deploy backend. It restarts with the secret. Registration without a
   valid token now returns 403 INVALID_CAPTCHA.
2. Redeploy frontend (full rebuild). Verify the build log shows the
   site key present at build time. Only the rebuilt bundle renders the
   widget, because the key is inlined during `next build`.

Reversing the order shows users a widget the backend cannot verify yet
(frontend first) or rejects every registration until the widget ships
(backend first without frontend rebuild). Backend first keeps the window
to minutes: old frontend posts no token and gets 403, which is the
fail-closed behavior, until the new frontend ships.

## Step 3. One live register test

1. Open `https://nabeeh.app/ar/register` in a clean profile.
2. Confirm the Turnstile widget renders. No widget means the frontend
   deployed bundle predates the key: rebuild, do not proceed.
3. Submit without solving: expect `captchaRequired`, no account created.
4. Solve and submit with a throwaway address, e.g.
   `captcha-probe-<date>@nabeeh.app`. Expect success plus redirect
   to login. Log in once to confirm the account works end to end.

## Step 4. Cleanup the test account

1. In Supabase Auth dashboard, delete the probe auth user. The teachers
   row cascades (`teachers.id` references `auth.users`).
2. Confirm: teachers row gone, one `register` plus one `login` row in
   `auth_audit_log` for forensics, zero other rows touched.
3. If anything else was created during the test, delete it before
   calling the runbook done.

## Rollback

Unset both keys and redeploy both services to return to the
pre-captcha state. Registration stays rate limited at 20/hour either way.
