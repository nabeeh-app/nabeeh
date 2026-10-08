# Phase 2 design: database-enforced multi-tenancy

Status: DESIGN ONLY. No migration in this change. Operator approval required
before applying anything. Tracked debt: the Phase 0 switch of reads to
`supabaseAdmin` in `backend/` is reversed by D3 once this phase lands.

## D0. Identity path (decided from live evidence)

The project exposes legacy HS256 API keys, measured via
`GET /v1/projects/{ref}/api-keys` on 2026-10-08. PostgREST therefore accepts
HS256 JWTs signed with the legacy JWT secret. Operator copies it once from
Dashboard, Project Settings, API, section JWT Secret legacy, into the
backend env as `SUPABASE_JWT_SECRET`. It never enters the repo.

Per request the backend mints a short-lived JWT, HS256, with claims
`sub` = actor auth id, `role` = `authenticated`, `tenant_id` = owner
`teachers.id`, `actor_role` = teacher or assistant, `exp` = 60 seconds.
Assistants always carry the OWNER tenant id, the actor id stays separate
for audit. The per-request client is built from the anon key with
`Authorization: Bearer <minted>` and nothing else. `supabaseAdmin` leaves
request handlers entirely.

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

## P1. Can a student have more than one teacher? Yes.

Schema proof: `enrollments` carries `UNIQUE(student_id, group_id)` only.
Nothing stops one student row from enrolling under two teachers groups.
`UNIQUE(teacher_id, student_code)` scopes codes, not rows. Live proof: the
Phase 0 battery enrolled teacher A student under teacher B before the fix.

Recommendation: keep sharing legal. `students.tenant_id` records the
creator owner. `enrollments.tenant_id` records the enrolling owner and must
equal the group owner via composite FK. Reads scope through the caller own
enrollments, never through `students.tenant_id` alone. Strict single-owner
would break legitimate re-enrollment and buys nothing RLS cannot enforce
per row.

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
by jti. The `payments` storage bucket goes private with path prefix
`{tenant_id}/...`, storage RLS on the prefix, short-TTL signed URLs only.

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

Chain tables add no extra predicate. The composite FK already guarantees
the parent belongs to the tenant, and the parent policy enforces the rest.
One policy per table keeps the audit readable.

Token-bound tables keep bearer-secret access by unguessable token plus the
tenant check where a teacher column exists:

```sql
create policy self_registration_submit on self_registration_tokens
  for select using (true);
```

Scope that exception narrowly. It exists only for anonymous submit links.
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

## Rollout order for approval

1. pg_dump taken, done 2026-10-08.
2. Migration A: add nullable `tenant_id`, backfill, verify zero NULLs and
   zero orphans, set NOT NULL, add UNIQUE and composite FKs, add
   `current_tenant_id()`.
3. Migration B: rewrite policies per templates, enable plus FORCE RLS on
   every tenant table, storage bucket private plus storage policies.
4. Backend: per-request mint plus scoped client, remove `supabaseAdmin`
   from handlers into the allowlisted module, CI guard stays green.
5. Live matrix rerun plus full suite, then Phase 4 pgTAP tests.
