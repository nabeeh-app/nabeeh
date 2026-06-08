# 0001 — Per-teacher student ownership and normalized schema

**Status:** Accepted  
**Schema:** `database/migrations/001_initial_schema.sql` + `002_rls_policies.sql`

The original `schema.sql` used a flat model where students had a direct `teacher_id` foreign key. A later `schema_v2.sql` normalized everything but made students global (shared across teachers), which doesn't match the business model — each teacher owns their students.

We're adopting a hybrid: normalized tables (offerings, groups, enrollments, assessments) but with students scoped to a teacher, not global. The access chain is: teacher → offerings → groups → enrollments → students. The WhatsApp bot, all API routes, and the frontend must use this single schema. The old flat `schema.sql` and the conflicting migration files (001–004) are retired.

**Considered alternatives:**
- Global students (v2): rejected because teachers must not see each other's students
- Fully flat (v1): rejected because it can't express the group → enrollment → assessment model cleanly

**Consequences:**
- Every query must go through the enrollment chain to access student data
- The WhatsApp bot's parent lookup requires: parent.phone → parents → students → enrollments → groups → offerings → teacher_id
- A fresh Supabase database is needed (the project is inactive, no real data to migrate)
