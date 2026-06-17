-- Migration 008: Denormalize teacher_id to enrollments
-- Adds teacher_id directly to enrollments for fast direct filtering
-- without traversing groups -> offerings chain every time.

-- 1. Add teacher_id column
ALTER TABLE enrollments ADD COLUMN teacher_id UUID REFERENCES teachers(id);

-- 2. Index for fast filtering
CREATE INDEX idx_enrollments_teacher_id ON enrollments(teacher_id);

-- 3. Backfill from existing chain
UPDATE enrollments e
SET teacher_id = o.teacher_id
FROM groups g JOIN offerings o ON g.offering_id = o.id
WHERE e.group_id = g.id;

-- 4. NOT NULL constraint after backfill
ALTER TABLE enrollments ALTER COLUMN teacher_id SET NOT NULL;

-- 5. Trigger to auto-populate on insert
CREATE OR REPLACE FUNCTION set_enrollment_teacher_id()
RETURNS TRIGGER AS $$
BEGIN
  SELECT o.teacher_id INTO NEW.teacher_id
  FROM groups g JOIN offerings o ON g.offering_id = o.id
  WHERE g.id = NEW.group_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enrollment_teacher_trigger
  BEFORE INSERT ON enrollments
  FOR EACH ROW EXECUTE FUNCTION set_enrollment_teacher_id();
