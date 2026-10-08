-- Code in backend/routes/attendance.js reads and writes locked_by_type and
-- expires_at on attendance_locks, but no earlier migration creates them.
-- Adds both as nullable so existing rows are untouched.
ALTER TABLE attendance_locks
  ADD COLUMN IF NOT EXISTS locked_by_type TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
