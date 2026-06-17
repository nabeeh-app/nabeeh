-- Migration 009: Database views for common query patterns
-- Pre-computed views that eliminate repeated multi-table joins

-- View: teacher students with enrollment + group + offering info
CREATE OR REPLACE VIEW teacher_students AS
SELECT
  s.id as student_id,
  s.name as student_name,
  s.student_code,
  s.phone as student_phone,
  s.created_at as student_created_at,
  e.id as enrollment_id,
  e.status as enrollment_status,
  e.enrolled_at,
  e.teacher_id,
  g.id as group_id,
  g.name as group_name,
  o.id as offering_id,
  o.academic_year,
  sub.id as subject_id,
  sub.name_en as subject_name,
  sub.name_ar as subject_name_ar,
  sub.code as subject_code,
  gl.id as grade_level_id,
  gl.name as grade_level_name
FROM students s
JOIN enrollments e ON s.id = e.student_id
JOIN groups g ON e.group_id = g.id
JOIN offerings o ON g.offering_id = o.id
JOIN subjects sub ON o.subject_id = sub.id
JOIN grade_levels gl ON o.grade_level_id = gl.id;

-- View: student stats per teacher (attendance + grades aggregated)
CREATE OR REPLACE VIEW teacher_student_stats AS
SELECT
  ts.teacher_id,
  ts.student_id,
  ts.student_name,
  ts.student_code,
  ts.enrollment_id,
  ts.group_name,
  ts.subject_name,
  -- Attendance stats
  COUNT(DISTINCT att.id) FILTER (WHERE att.status = 'present') as present_count,
  COUNT(DISTINCT att.id) FILTER (WHERE att.status = 'absent') as absent_count,
  COUNT(DISTINCT att.id) FILTER (WHERE att.status = 'late') as late_count,
  COUNT(DISTINCT att.id) FILTER (WHERE att.status = 'excused') as excused_count,
  COUNT(DISTINCT att.id) as total_attendance_records,
  -- Grade stats
  AVG(CASE WHEN a.max_score > 0 THEN (gr.score::float / a.max_score) * 100 END) as avg_grade_percentage,
  COUNT(DISTINCT gr.id) as total_grades
FROM teacher_students ts
LEFT JOIN attendance att ON att.enrollment_id = ts.enrollment_id
LEFT JOIN grades gr ON gr.enrollment_id = ts.enrollment_id
LEFT JOIN assessments a ON gr.assessment_id = a.id
WHERE ts.enrollment_status = 'active'
GROUP BY ts.teacher_id, ts.student_id, ts.student_name, ts.student_code,
         ts.enrollment_id, ts.group_name, ts.subject_name;

-- View: conversations with latest message for messaging UI
CREATE OR REPLACE VIEW conversation_details AS
SELECT
  c.id as conversation_id,
  c.teacher_id,
  c.parent_id,
  c.whatsapp_chat_id,
  c.created_at,
  c.last_message_at,
  p.name as parent_name,
  p.phone as parent_phone,
  p.preferred_language,
  s.name as student_name,
  s.student_code,
  (
    SELECT content FROM messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC LIMIT 1
  ) as last_message_content,
  (
    SELECT direction FROM messages m
    WHERE m.conversation_id = c.id
    ORDER BY m.created_at DESC LIMIT 1
  ) as last_message_direction
FROM conversations c
JOIN parents p ON c.parent_id = p.id
JOIN students s ON p.student_id = s.id;
