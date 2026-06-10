# 0006 — Assistant model, permissions, concurrent access, and Google login

**Status:** Accepted

Teachers need assistants who can operate on their behalf with scoped permissions. Assistants are separate Supabase Auth users (own login) linked to one or more teachers via a `teacher_assistants` junction table. Teachers control 8 boolean permission flags per assistant, can invite via email, and can deactivate without deleting. An assistant working for multiple teachers sees a different permission set per teacher and switches context via a UI dropdown.

RLS stays teacher-only (`auth.uid() = teacher_id`). Assistant requests go through the backend using `supabaseAdmin` with app-level permission checks. This avoids rewriting every RLS policy to include assistant subqueries and keeps the security model maintainable as new tables are added.

Concurrent attendance editing uses pessimistic locking at the student-row level. An `attendance_locks` table tracks `(session_id, student_id, locked_by, locked_at)`. Locks auto-release after 5 minutes (configurable per teacher). Two people can mark attendance for the same session if they're editing different students.

The WhatsApp bot auto-pauses when a human takes over a conversation. The pause duration is configurable. Parents always see the teacher's identity — assistants operate under the teacher's name. `conversations` gains `last_responder_id`, `last_responder_type`, and `bot_paused_until` columns.

A full `action_audit_log` tracks every action (attendance, grades, student edits, WhatsApp messages) with actor identity, action type, entity reference, and timestamp. This gives accountability without relying on RLS.

Google Login is handled by Supabase's built-in Google OAuth provider. Both teachers and assistants can sign in with Google on both login and register pages. If a user already has an email/password account, signing in with Google on the same email auto-links the Google provider to the existing account (no duplicate accounts). For assistants, the invited email must match the Google account email exactly (strict mode). First-time Google signups go through a quick onboarding flow (confirm name, subjects, timezone from Google profile) followed by an in-app product tour.

**Considered alternatives:**
- Shared credentials (assistant logs in as teacher): rejected because JWT collisions make audit logs meaningless and you can't distinguish who did what
- RLS subquery expansion (policies check `teacher_assistants` table): rejected because every new table requires a policy update and subqueries are slow at scale
- Pessimistic locking at session level: rejected because it blocks all edits when two people need to work on different students in the same session
- Bot always runs / bot never runs: rejected because parents get confused by duplicate replies or miss important human responses

**Consequences:**
- Every new route that touches teacher data must check assistant permissions via middleware, not RLS
- The `teacher_assistants` table becomes a hot path — needs an index on `(teacher_id, status)` and `(assistant_id)`
- Subscription tier changes must cascade to assistant limits (deactivate excess assistants on downgrade)
- The audit log will grow fast — consider partitioning by month or archiving old entries
- The invite flow requires email delivery infrastructure (not yet implemented)
