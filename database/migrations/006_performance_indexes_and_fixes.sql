-- Performance indexes and bug fixes
-- Phase 1: Quick wins

-- Fix 1: Add date column to attendance + UNIQUE constraint for upsert
-- The attendance table only has session_id, but the upsert pattern needs
-- enrollment_id + date. Adding date directly enables the upsert.
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS date DATE;

-- Backfill date from sessions for existing records
UPDATE attendance a
SET date = s.date
FROM sessions s
WHERE a.session_id = s.id AND a.date IS NULL;

-- Now add the NOT NULL constraint and unique constraint
ALTER TABLE attendance ALTER COLUMN date SET NOT NULL;
ALTER TABLE attendance ADD CONSTRAINT attendance_enrollment_date_unique
  UNIQUE (enrollment_id, date);

-- Fix 2: Add missing indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_parents_phone ON parents(phone);
CREATE INDEX IF NOT EXISTS idx_conversations_parent_teacher ON conversations(parent_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_assessments_offering_name_date ON assessments(offering_id, name, date);
CREATE INDEX IF NOT EXISTS idx_faqs_teacher_language_active ON faqs(teacher_id, language, is_active);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offerings_subject_id ON offerings(subject_id);
CREATE INDEX IF NOT EXISTS idx_offerings_grade_level_id ON offerings(grade_level_id);

-- Fix 3: Remove redundant index (already covered by UNIQUE constraint on (teacher_id, student_code))
DROP INDEX IF EXISTS idx_students_teacher_code;
