-- ROLLBACK for 022_stage2_unique_and_composite_fks.sql (run manually).
-- Drops the 15 composite FKs and 8 unique pairs, restores the original
-- single-column FKs with their original ON DELETE CASCADE actions.
-- Loses no data: constraints only.

ALTER TABLE groups DROP CONSTRAINT IF EXISTS fk_groups_tenant_offering;
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS fk_enrollments_tenant_group;
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS fk_enrollments_tenant_student;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS fk_sessions_tenant_group;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS fk_attendance_tenant_session;
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS fk_attendance_tenant_enrollment;
ALTER TABLE attendance_locks DROP CONSTRAINT IF EXISTS fk_attendance_locks_tenant_session;
ALTER TABLE attendance_locks DROP CONSTRAINT IF EXISTS fk_attendance_locks_tenant_student;
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS fk_assessments_tenant_offering;
ALTER TABLE grades DROP CONSTRAINT IF EXISTS fk_grades_tenant_enrollment;
ALTER TABLE grades DROP CONSTRAINT IF EXISTS fk_grades_tenant_assessment;
ALTER TABLE parents DROP CONSTRAINT IF EXISTS fk_parents_tenant_student;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS fk_conversations_tenant_parent;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS fk_messages_tenant_conversation;
ALTER TABLE report_drafts DROP CONSTRAINT IF EXISTS fk_report_drafts_tenant_student;

ALTER TABLE students DROP CONSTRAINT IF EXISTS uq_students_tenant_id;
ALTER TABLE parents DROP CONSTRAINT IF EXISTS uq_parents_tenant_id;
ALTER TABLE offerings DROP CONSTRAINT IF EXISTS uq_offerings_tenant_id;
ALTER TABLE groups DROP CONSTRAINT IF EXISTS uq_groups_tenant_id;
ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS uq_enrollments_tenant_id;
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS uq_sessions_tenant_id;
ALTER TABLE assessments DROP CONSTRAINT IF EXISTS uq_assessments_tenant_id;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS uq_conversations_tenant_id;

ALTER TABLE groups ADD CONSTRAINT groups_offering_id_fkey
  FOREIGN KEY (offering_id) REFERENCES offerings(id) ON DELETE CASCADE;
ALTER TABLE enrollments ADD CONSTRAINT enrollments_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE enrollments ADD CONSTRAINT enrollments_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE sessions ADD CONSTRAINT sessions_group_id_fkey
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE attendance ADD CONSTRAINT attendance_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;
ALTER TABLE attendance ADD CONSTRAINT attendance_enrollment_id_fkey
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE;
ALTER TABLE attendance_locks ADD CONSTRAINT attendance_locks_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE;
ALTER TABLE attendance_locks ADD CONSTRAINT attendance_locks_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE assessments ADD CONSTRAINT assessments_offering_id_fkey
  FOREIGN KEY (offering_id) REFERENCES offerings(id) ON DELETE CASCADE;
ALTER TABLE grades ADD CONSTRAINT grades_enrollment_id_fkey
  FOREIGN KEY (enrollment_id) REFERENCES enrollments(id) ON DELETE CASCADE;
ALTER TABLE grades ADD CONSTRAINT grades_assessment_id_fkey
  FOREIGN KEY (assessment_id) REFERENCES assessments(id) ON DELETE CASCADE;
ALTER TABLE parents ADD CONSTRAINT parents_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD CONSTRAINT conversations_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES parents(id) ON DELETE CASCADE;
ALTER TABLE messages ADD CONSTRAINT messages_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;
ALTER TABLE report_drafts ADD CONSTRAINT report_drafts_student_id_fkey
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;
