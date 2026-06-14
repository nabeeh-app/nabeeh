const { supabaseAdmin } = require('../config/database');

/**
 * Fetch all enrollment data for a teacher's students in bulk.
 *
 * @param {string} teacherId
 * @param {object} [opts]
 * @param {{ start: string, end: string }} [opts.dateRange] - filter attendance/grades by date
 * @param {number} [opts.sessionLimit] - limit sessions per group (most recent N)
 * @returns {Promise<{ enrollments: Array, sessions: Array, attendance: Array, grades: Array }>}
 */
async function fetchEnrollmentData(teacherId, opts = {}) {
  // 1. Get all enrollments via the enrollment chain
  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select(`
      id,
      student_id,
      students(name),
      group:groups!inner(id, offering:offerings!inner(teacher_id))
    `)
    .eq('group.offering.teacher_id', teacherId);

  if (!enrollments || enrollments.length === 0) {
    return { enrollments: [], sessions: [], attendance: [], grades: [] };
  }

  const groupIds = [...new Set(enrollments.map(e => e.group?.id).filter(Boolean))];
  const enrollmentIds = enrollments.map(e => e.id);

  // 2. Fetch all sessions for those groups
  let sessionsQuery = supabaseAdmin
    .from('sessions')
    .select('id, date, group_id')
    .in('group_id', groupIds);

  if (opts.dateRange) {
    sessionsQuery = sessionsQuery
      .gte('date', opts.dateRange.start)
      .lte('date', opts.dateRange.end);
  }

  const { data: allSessions } = await sessionsQuery;
  let sessions = allSessions || [];

  // Optionally limit to most recent N sessions per group
  if (opts.sessionLimit && sessions.length > 0) {
    const byGroup = new Map();
    for (const s of sessions) {
      if (!byGroup.has(s.group_id)) byGroup.set(s.group_id, []);
      byGroup.get(s.group_id).push(s);
    }
    sessions = [];
    for (const groupSessions of byGroup.values()) {
      groupSessions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      sessions.push(...groupSessions.slice(0, opts.sessionLimit));
    }
  }

  const sessionIds = sessions.map(s => s.id);

  // 3. Fetch all attendance for those enrollments/sessions
  let attendanceQuery = supabaseAdmin
    .from('attendance')
    .select('enrollment_id, status, session_id, session:sessions(date)')
    .in('enrollment_id', enrollmentIds);

  if (sessionIds.length > 0) {
    attendanceQuery = attendanceQuery.in('session_id', sessionIds);
  }

  const { data: allAttendance } = await attendanceQuery;

  // 4. Fetch all grades for those enrollments
  let gradesQuery = supabaseAdmin
    .from('grades')
    .select('enrollment_id, score, assessment:assessments(name, date, max_score)')
    .in('enrollment_id', enrollmentIds);

  if (opts.dateRange) {
    gradesQuery = gradesQuery
      .gte('assessment.date', opts.dateRange.start)
      .lte('assessment.date', opts.dateRange.end);
  }

  const { data: allGrades } = await gradesQuery;

  return {
    enrollments,
    sessions,
    attendance: allAttendance || [],
    grades: allGrades || [],
  };
}

module.exports = { fetchEnrollmentData };
