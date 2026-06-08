# 0002 — Auth and security standards

JWT secrets must be cryptographically random (not human-readable strings). Rate limiting is env-gated (enabled in production, disabled in development). CORS origins are configurable via `CORS_ORIGINS` env var. All `console.log` statements in the backend are replaced with the Winston logger singleton. JWT tokens are stored in httpOnly cookies with CSRF protection, not localStorage. Supabase clients are standardized: `config/database.js` exports `{ supabase, supabaseAdmin }` — `supabase` for reads (anon key), `supabaseAdmin` for admin writes (service-role key). No route file creates its own Supabase client.

**Considered alternatives:**
- Service-role everywhere: rejected because a single RLS misconfiguration would expose all data
- Anon everywhere: rejected because RLS policies are hard to get right and debug
- localStorage for JWT: rejected because XSS-vulnerable
