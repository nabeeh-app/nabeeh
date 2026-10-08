# Phase 2 design: database-enforced multi-tenancy

Status: APPROVED WITH CHANGES 2026-10-08. P1 decided per-tenant rows
(operator override). Push of related commits waits for operator env
confirmation. Stage gates: fresh pg_dump before stage 1, tested rollback
SQL per stage, STOP + matrix + suite + "next" after every stage.

## D0. Identity path (decided from live evidence)

The project exposes legacy HS256 API keys, measured via
`GET /v1/projects/{ref}/api-keys` on 2026-10-08. PostgREST therefore accepts
HS256 JWTs signed with the legacy JWT secret. Operator copies it once from
Dashboard, Project Settings, API, section JWT Secret legacy, into the
backend env as `SUPABASE_JWT_SECRET`. It never enters the repo.

Per request the backend mints a short-lived JWT, HS256, with claims
`sub` = actor auth id, `role` = `authenticated` ONLY, never
`service_role`, `tenant_id` = owner `teachers.id`, `actor_id` = actor auth
id, `actor_role` = teacher or assistant, `exp` <= 60 seconds.
Assistants always carry the OWNER tenant id, the actor id stays separate
for audit. The per-request client is built from the anon key with
`Authorization: Bearer <minted>` and nothing else. `supabaseAdmin` leaves
request handlers entirely.

Minting lives in exactly one function in one module,
`backend/lib/privileged/` or equivalent. The legacy JWT secret is read
from env in that module only. A later JWKS switch touches that one file.
No other file imports the secret, builds tenant JWTs, or constructs
privileged clients.

SQL helper, created once:

```sql
create or replace function public.current_tenant_id()
returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'tenant_id', '')::uuid
$$;
```

If the dashboard ever shows HS256 retired, stop. The fallback is a
per-request Supabase Auth session, which costs a sign-in per request and
needs its own design. Do not invent a SET LOCAL scheme. PostgREST gives
one transaction per request with no hook for session state.

## P1. DECIDED: per-tenant student rows. No cross-teacher sharing.

Operator decision 2026-10-08, overrides the earlier keep-sharing
recommendation. The Phase 0 repro enrollment was the enroll leak itself,
not a product requirement. A child studying with two teachers is two
student rows, one per tenant.

- `students.tenant_id` and `parents.tenant_id` NOT NULL.
- `enrollments` carries `tenant_id` with composite FKs
  `(tenant_id, student_id)` to `students(tenant_id, id)`,
  `(tenant_id, group_id)` to `groups(tenant_id, id)`. Same pattern for
  every child to parent reference: groups to offerings, sessions to
  groups, attendance to enrollments and sessions, assessments to
  offerings, grades to enrollments and assessments, parents to students,
  messages to conversations, locks to sessions and students.
- Policies are uniformly `tenant_id = current_tenant_id()`. No reads
  scoped through enrollments. The enrollment chain stays as the domain
  navigation path, but isolation comes from the tenant predicate, not
  from chain traversal.
- Sharing-flow audit 2026-10-08: no legitimate flow assumes
  cross-teacher student sharing. All creates (`students.js` create,
  `import.js` execute, `selfRegistration.js` submit) mint a fresh
  student plus enrollment plus parents under the caller or token owner.
  All reads resolve through the caller own enrollments
  (`verifyStudentAccess`, `getTeacherEnrollments`,
  `batchResolveEnrollmentsWithOfferings`, bot `getParentByPhone` scoped
  to the session teacher). The single flow that ever accepted a foreign
  student id was manual `POST enroll`, the Phase 0 leak, now blocked and
  to be hardened in stage 5 with an explicit `students.tenant_id` check
  plus the composite FK as the backstop. Same-phone parents under two
  teachers become two parent rows; each teacher bot sees its own.

## Table list

`teachers` is the tenant root. No new column. Policies compare `id` to
`current_tenant_id()`. Every other table gets `tenant_id uuid NOT NULL`
plus `UNIQUE (tenant_id, id)`, backfilled from the enrollment chain while
tables are empty or test-only, then set NOT NULL. Child to parent
references become composite `(tenant_id, parent_id)` against the parent
`(tenant_id, id)`, so a row can never point at another tenant parent.

Direct owner, backfill from existing `teacher_id`: students, offerings,
conversations, teacher_settings, faqs, alerts, alert_rules, notifications,
report_drafts, weekly_digests, subscriptions, payments, failed_messages,
whatsapp_sessions, whatsapp_auth_creds, whatsapp_auth_keys,
self_registration_tokens, attendance_locks via session owner,
teacher_assistants owner side, assistant_invites, action_audit_log,
auth_audit_log, password_reset_tokens via teacher.

Chain owner, backfill by walking up: groups via offering, enrollments via
group, sessions via group, attendance via enrollment, assessments via
offering, grades via enrollment, parents via first enrolled student,
messages via conversation.

Global by design, no column: subjects, grade_levels, revoked_tokens keyed
by jti. Platform scope, no column, admin-path policies unchanged:
admin_users, support_tickets, admin_audit_log. These are reached through
the admin app with its own auth, never through teacher JWTs.
`auth_audit_log.tenant_id` stays NULLABLE: 75 of 153 prod rows are
pre-authentication login events with no teacher to map to. Backfill what
maps, keep NULL for pre-auth rows, policy is tenant-match only so NULL
rows are service-role forensics, invisible to tenants. This is the single
documented exception to NOT NULL. The `payments` storage bucket goes
private with path prefix `{tenant_id}/...`, storage RLS on the prefix,
short-TTL signed URLs only.

Stage 1 adds columns plus backfill plus stamp triggers plus NOT NULL
(auth_audit_log excepted) so pre-stage-5 code keeps writing while every
new row lands stamped. Triggers also lock `tenant_id` against UPDATE.

## RLS policy templates

Direct-owned tables, all commands, force row level security:

```sql
alter table students enable row level security;
alter table students force row level security;

create policy teacher_isolation on students
  for all
  using (tenant_id = current_tenant_id())
  with check (tenant_id = current_tenant_id());
```

Chain tables carry the SAME uniform predicate on their own `tenant_id`.
The composite FK guarantees the parent belongs to the same tenant, the
policy enforces it per row anyway. One identical policy per table keeps
the audit readable and leaves no table relying on traversal.

Anonymous self-registration needs no DB exception: submitters never touch
PostgREST. The backend mediates every token read and write through
service_role. No anon policy exists on any table after stage 3.
Everything else follows the tenant template with both USING and WITH CHECK
clauses. Never write USING without WITH CHECK on insert or update paths.

Storage template:

```sql
create policy tenant_receipts on storage.objects
  for all
  using (bucket_id = 'payments' and (storage.foldername(name))[1] = current_tenant_id()::text)
  with check (bucket_id = 'payments' and (storage.foldername(name))[1] = current_tenant_id()::text);
```

Serve receipts through signed URLs with short TTL. Rotate any URL minted
while the bucket was public.

## Rollout order, staged with gates

0. Fresh pg_dump before stage 1. Tested rollback SQL per stage, stored
   next to the migration.
1. `tenant_id` columns plus backfill plus stamp triggers plus NOT NULL
   (auth_audit_log excepted, see above). `failed_messages` and
   `self_registration_tokens` are created IF NOT EXISTS with the column
   where missing in prod. STOP, report, matrix plus suite, wait "next".
2. `UNIQUE (tenant_id, id)` plus composite FKs plus indexes. STOP,
   report, matrix plus suite, wait "next".
3. `current_tenant_id()` plus policies with USING and WITH CHECK on
   every tenant table. RLS enabled but NOT forced yet. New CI test:
   every table with `tenant_id` must have RLS enabled and at least one
   policy. STOP, report, matrix plus suite, wait "next".
4. Storage private plus path policies plus signed URLs. Rotate any URL
   minted while the bucket was public. STOP, report, wait "next".
5. Route migration from `supabaseAdmin` to the per-request scoped
   client, route by route. Keep `supabaseAdmin` on a route until its
   scoped version passes the matrix. Never leave a route half migrated.
   STOP per route group, report, wait "next".
6. FORCE RLS everywhere. STOP, full matrix, full suite, then Phase 4
   pgTAP tests.
