-- Stage 2: UNIQUE (tenant_id, id) + composite FKs (tenant_id, parent_id).
-- P1 decision: per-tenant rows. A composite FK makes cross-tenant
-- references structurally impossible: the parent row must share the
-- child tenant_id. Replaces the single-column FKs listed below, keeping
-- their original ON DELETE actions.
--
-- NULLABILITY (operator rule: composite members NOT NULL, else MATCH FULL):
-- every composite pair below is NOT NULL on both sides (verified against
-- prod information_schema 2026-10-08). The three nullable references
-- stay single-column and are documented, not converted:
--   alerts.student_id, alerts.alert_rule_id (nullable, ON DELETE SET NULL)
--   report_drafts.group_id (nullable, ON DELETE SET NULL)
--   payments.subscription_id (nullable, no action)
--   self_registration_tokens.group_id / teacher_id (nullable, CASCADE)
-- No MATCH FULL needed: nothing nullable is composited.
--
-- SET NULL audit: the only SET NULL FKs in the schema are the three above.
-- None involves tenant_id. No SET NULL touches tenant_id anywhere.
--
-- Kept single-column by design (target has no tenant_id):
--   *.teacher_id -> teachers(id), locked_by -> auth.users(id),
--   assistant_id -> auth.users(id), teacher_subjects -> subjects(id),
--   offerings -> subjects/grade_levels, verified_by -> admin_users(id).
--   enrollments.teacher_id (008 denormalized crutch) stays until stage 5
--   code stops reading it; its cleanup is a later deletion, not this stage.

-- ============================================================
-- 0. PRE-ADD ASSERTS: every child tenant must equal its parent tenant
-- ============================================================
DO $$
DECLARE
  n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM groups g JOIN offerings o ON g.offering_id = o.id WHERE g.tenant_id IS DISTINCT FROM o.tenant_id;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % groups tenant != offering tenant', n; END IF;
  SELECT COUNT(*) INTO n FROM enrollments e JOIN groups g ON e.group_id = g.id WHERE e.tenant_id IS DISTINCT FROM g.tenant_id;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % enrollments tenant != group tenant', n; END IF;
  SELECT COUNT(*) INTO n FROM enrollments e JOIN students s ON e.student_id = s.id WHERE e.tenant_id IS DISTINCT FROM s.tenant_id;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % enrollments tenant != student tenant', n; END IF;
  SELECT COUNT(*) INTO n FROM sessions s JOIN groups g ON s.group_id = g.id WHERE s.tenant_id IS DISTINCT FROM g.tenant_id;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % sessions tenant != group tenant', n; END IF;
  SELECT COUNT(*) INTO n FROM attendance a JOIN sessions s ON a.session_id = s.id WHERE a.tenant_id IS DISTINCT FROM s.tenant_id;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % attendance tenant != session tenant', n; END IF;
  SELECT COUNT(*) INTO n FROM attendance a JOIN enrollments e ON a.enrollment_id = e.id WHERE a.tenant_id IS DISTINCT FROM e.tenant_id;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % attendance tenant != enrollment tenant', n; END IF;
  SELECT COUNT(*) INTO n FROM attendance_locks l JOIN sessions s ON l.session_id = s.id WHERE l.tenant_id IS DISTINCT FROM s.tenant_id;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % locks tenant != session tenant', n; END IF;
  SELECT COUNT(*) INTO n FROM attendance_locks l JOIN students s ON l.student_id = s.id WHERE l.tenant_id IS DISTINCT FROM s.tenant_id;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % locks tenant != student tenant', n; END IF;
  SELECT COUNT(*) INTO n FROM assessments a JOIN offerings o ON a.offering_id = o.id WHERE a.tenant_id IS DISTINCT FROM o.tenant_id;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % assessments tenant != offering tenant', n; END IF;
  SELECT COUNT(*) INTO n FROM grades g JOIN enrollments e ON g.enrollment_id = e.id WHERE g.tenant_id IS DISTINCT FROM e.tenant_id;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % grades tenant != enrollment tenant', n; END IF;
  SELECT COUNT(*) INTO n FROM grades g JOIN assessments a ON g.assessment_id = a.id JOIN offerings o ON a.offering_id = o.id WHERE g.tenant_id IS DISTINCT FROM o.tenant_id;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % grades tenant != assessment tenant', n; END IF;
  SELECT COUNT(*) INTO n FROM parents p JOIN students s ON p.student_id = s.id WHERE p.tenant_id IS DISTINCT FROM s.tenant_id;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % parents tenant != student tenant', n; END IF;
  SELECT COUNT(*) INTO n FROM conversations c JOIN parents p ON c.parent_id = p.id WHERE c.tenant_id IS DISTINCT FROM p.tenant_id;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % conversations tenant != parent tenant', n; END IF;
  SELECT COUNT(*) INTO n FROM messages m JOIN conversations c ON m.conversation_id = c.id WHERE m.tenant_id IS DISTINCT FROM c.tenant_id;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % messages tenant != conversation tenant', n; END IF;
  SELECT COUNT(*) INTO n FROM report_drafts r JOIN students s ON r.student_id = s.id WHERE r.tenant_id IS DISTINCT FROM s.tenant_id;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % report_drafts tenant != student tenant', n; END IF;
END $$;

-- ============================================================
-- 1. UNIQUE (tenant_id, id) on composite-FK target tables only.
-- Referenced parents need the unique pair; nothing references the rest,
-- so no redundant indexes there.
-- ============================================================
ALTER TABLE students ADD CONSTRAINT uq_students_tenant_id UNIQUE (tenant_id, id);
ALTER TABLE parents ADD CONSTRAINT uq_parents_tenant_id UNIQUE (tenant_id, id);
ALTER TABLE offerings ADD CONSTRAINT uq_offerings_tenant_id UNIQUE (tenant_id, id);
ALTER TABLE groups ADD CONSTRAINT uq_groups_tenant_id UNIQUE (tenant_id, id);
ALTER TABLE enrollments ADD CONSTRAINT uq_enrollments_tenant_id UNIQUE (tenant_id, id);
ALTER TABLE sessions ADD CONSTRAINT uq_sessions_tenant_id UNIQUE (tenant_id, id);
ALTER TABLE assessments ADD CONSTRAINT uq_assessments_tenant_id UNIQUE (tenant_id, id);
ALTER TABLE conversations ADD CONSTRAINT uq_conversations_tenant_id UNIQUE (tenant_id, id);

-- ============================================================
-- 2. DROP replaced single-column FKs (names verified on prod)
-- ============================================================
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_offering_id_fkey;
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_group_id_fkey;
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS enrollments_student_id_fkey;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_group_id_fkey;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_session_id_fkey;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_enrollment_id_fkey;
ALTER TABLE attendance_locks DROP CONSTRAINT IF EXISTS attendance_locks_session_id_fkey;
ALTER TABLE attendance_locks DROP CONSTRAINT IF EXISTS attendance_locks_student_id_fkey;
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS assessments_offering_id_fkey;
ALTER TABLE grades DROP CONSTRAINT IF EXISTS grades_enrollment_id_fkey;
ALTER TABLE grades DROP CONSTRAINT IF EXISTS grades_assessment_id_fkey;
ALTER TABLE parents DROP CONSTRAINT IF EXISTS parents_student_id_fkey;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_parent_id_fkey;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_conversation_id_fkey;
ALTER TABLE report_drafts DROP CONSTRAINT IF EXISTS report_drafts_student_id_fkey;

-- ============================================================
-- 3. Composite FKs, ON DELETE explicit (CASCADE everywhere, as before)
-- ============================================================
ALTER TABLE groups ADD CONSTRAINT fk_groups_tenant_offering
  FOREIGN KEY (tenant_id, offering_id) REFERENCES offerings(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE enrollments ADD CONSTRAINT fk_enrollments_tenant_group
  FOREIGN KEY (tenant_id, group_id) REFERENCES groups(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE enrollments ADD CONSTRAINT fk_enrollments_tenant_student
  FOREIGN KEY (tenant_id, student_id) REFERENCES students(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE sessions ADD CONSTRAINT fk_sessions_tenant_group
  FOREIGN KEY (tenant_id, group_id) REFERENCES groups(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE attendance ADD CONSTRAINT fk_attendance_tenant_session
  FOREIGN KEY (tenant_id, session_id) REFERENCES sessions(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE attendance ADD CONSTRAINT fk_attendance_tenant_enrollment
  FOREIGN KEY (tenant_id, enrollment_id) REFERENCES enrollments(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE attendance_locks ADD CONSTRAINT fk_attendance_locks_tenant_session
  FOREIGN KEY (tenant_id, session_id) REFERENCES sessions(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE attendance_locks ADD CONSTRAINT fk_attendance_locks_tenant_student
  FOREIGN KEY (tenant_id, student_id) REFERENCES students(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE assessments ADD CONSTRAINT fk_assessments_tenant_offering
  FOREIGN KEY (tenant_id, offering_id) REFERENCES offerings(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE grades ADD CONSTRAINT fk_grades_tenant_enrollment
  FOREIGN KEY (tenant_id, enrollment_id) REFERENCES enrollments(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE grades ADD CONSTRAINT fk_grades_tenant_assessment
  FOREIGN KEY (tenant_id, assessment_id) REFERENCES assessments(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE parents ADD CONSTRAINT fk_parents_tenant_student
  FOREIGN KEY (tenant_id, student_id) REFERENCES students(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE conversations ADD CONSTRAINT fk_conversations_tenant_parent
  FOREIGN KEY (tenant_id, parent_id) REFERENCES parents(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT fk_messages_tenant_conversation
  FOREIGN KEY (tenant_id, conversation_id) REFERENCES conversations(tenant_id, id) ON DELETE CASCADE;
ALTER TABLE report_drafts ADD CONSTRAINT fk_report_drafts_tenant_student
  FOREIGN KEY (tenant_id, student_id) REFERENCES students(tenant_id, id) ON DELETE CASCADE;

-- ============================================================
-- 4. POST-ADD VERIFY: composites resolve on every existing row
-- ============================================================
DO $$
DECLARE
  n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM enrollments e
    LEFT JOIN students s ON s.tenant_id = e.tenant_id AND s.id = e.student_id
    WHERE s.id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % enrollments without matching (tenant,student)', n; END IF;
  SELECT COUNT(*) INTO n FROM grades g
    LEFT JOIN assessments a ON a.tenant_id = g.tenant_id AND a.id = g.assessment_id
    WHERE a.id IS NULL;
  IF n > 0 THEN RAISE EXCEPTION 'stage2: % grades without matching (tenant,assessment)', n; END IF;
END $$;
