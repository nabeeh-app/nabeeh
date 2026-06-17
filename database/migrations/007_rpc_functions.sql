-- Migration 007: PostgreSQL RPC functions to replace JS-side aggregation
-- Replaces N+1 queries and client-side loops with single DB calls

-- 1. Student count per teacher (replaces enrollment tree traversal in teachers.js)
CREATE OR REPLACE FUNCTION teacher_student_count(p_teacher_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(DISTINCT e.student_id)
  FROM enrollments e
  JOIN groups g ON e.group_id = g.id
  JOIN offerings o ON g.offering_id = o.id
  WHERE o.teacher_id = p_teacher_id;
$$ LANGUAGE sql STABLE;

-- 2. Message stats (replaces 4 separate count queries in messages.js)
CREATE OR REPLACE FUNCTION message_stats(
  p_teacher_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  total_count BIGINT,
  incoming_count BIGINT,
  automated_count BIGINT
) AS $$
  SELECT
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE m.direction = 'incoming') as incoming_count,
    COUNT(*) FILTER (WHERE m.is_automated = true) as automated_count
  FROM messages m
  JOIN conversations c ON m.conversation_id = c.id
  WHERE c.teacher_id = p_teacher_id
    AND m.created_at BETWEEN p_start_date AND p_end_date;
$$ LANGUAGE sql STABLE;

-- 3. Dashboard stats (replaces 5 separate queries in teachers.js)
CREATE OR REPLACE FUNCTION dashboard_stats(p_teacher_id UUID)
RETURNS JSON AS $$
  SELECT json_build_object(
    'student_count', (SELECT teacher_student_count(p_teacher_id)),
    'parent_count', (
      SELECT COUNT(DISTINCT p.id)
      FROM parents p
      JOIN students s ON p.student_id = s.id
      JOIN enrollments e ON s.id = e.student_id
      JOIN groups g ON e.group_id = g.id
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = p_teacher_id
    ),
    'today_attendance', (
      SELECT COUNT(*)
      FROM attendance a
      JOIN sessions sess ON a.session_id = sess.id
      JOIN groups g ON sess.group_id = g.id
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = p_teacher_id
        AND sess.date = CURRENT_DATE
    ),
    'weekly_messages', (
      SELECT COUNT(*)
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      WHERE c.teacher_id = p_teacher_id
        AND m.created_at >= NOW() - INTERVAL '7 days'
    )
  );
$$ LANGUAGE sql STABLE;

-- 4. Attendance summary (replaces JS-side aggregation in attendance.js)
CREATE OR REPLACE FUNCTION attendance_summary(
  p_teacher_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_sessions BIGINT,
  present_count BIGINT,
  absent_count BIGINT,
  late_count BIGINT,
  excused_count BIGINT,
  attendance_rate NUMERIC
) AS $$
  SELECT
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE a.status = 'present') as present_count,
    COUNT(*) FILTER (WHERE a.status = 'absent') as absent_count,
    COUNT(*) FILTER (WHERE a.status = 'late') as late_count,
    COUNT(*) FILTER (WHERE a.status = 'excused') as excused_count,
    ROUND(
      COUNT(*) FILTER (WHERE a.status = 'present') * 100.0 / NULLIF(COUNT(*), 0),
      1
    ) as attendance_rate
  FROM attendance a
  JOIN sessions sess ON a.session_id = sess.id
  JOIN groups g ON sess.group_id = g.id
  JOIN offerings o ON g.offering_id = o.id
  WHERE o.teacher_id = p_teacher_id
    AND sess.date BETWEEN p_start_date AND p_end_date;
$$ LANGUAGE sql STABLE;
