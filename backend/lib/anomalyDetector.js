const { supabaseAdmin } = require('../config/database');
const logger = require('./logger');

// ── Detect attendance anomalies ────────────────────────────────
async function detectAttendanceAnomalies(teacherId) {
  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select(`
      id,
      student_id,
      students(name),
      group:groups!inner(id, offering:offerings!inner(teacher_id))
    `)
    .eq('group.offering.teacher_id', teacherId);

  if (!enrollments || enrollments.length === 0) return [];

  const groupIds = [...new Set(enrollments.map(e => e.group?.id).filter(Boolean))];
  const { data: allSessions } = await supabaseAdmin
    .from('sessions').select('id, date, group_id')
    .in('group_id', groupIds);

  const sessionIds = (allSessions || []).map(s => s.id);
  const { data: allAttendance } = await supabaseAdmin
    .from('attendance').select('enrollment_id, status, session_id')
    .in('enrollment_id', enrollments.map(e => e.id))
    .in('session_id', sessionIds);

  const sessionMap = new Map((allSessions || []).map(s => [s.id, s]));
  const attendanceByEnrollment = new Map();
  for (const att of (allAttendance || [])) {
    if (!attendanceByEnrollment.has(att.enrollment_id)) attendanceByEnrollment.set(att.enrollment_id, []);
    attendanceByEnrollment.get(att.enrollment_id).push(att);
  }

  const anomalies = [];

  for (const enrollment of enrollments) {
    const studentId = enrollment.student_id;
    const studentName = enrollment.students?.name || 'Student';

    const enrollmentSessions = (allSessions || []).filter(s => s.group_id === enrollment.group?.id);
    enrollmentSessions.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const topSessions = enrollmentSessions.slice(0, 10);

    if (topSessions.length < 5) continue;

    const topSessionIds = new Set(topSessions.map(s => s.id));
    const attendanceData = (attendanceByEnrollment.get(enrollment.id) || [])
      .filter(a => topSessionIds.has(a.session_id));

    if (attendanceData.length === 0) continue;

    const recentCount = Math.min(3, attendanceData.length);
    const recent = attendanceData.slice(0, recentCount);
    const older = attendanceData.slice(recentCount);

    const recentPresent = recent.filter(a => a.status === 'present').length;
    const olderPresent = older.length > 0 ? older.filter(a => a.status === 'present').length : 0;

    const recentRate = recent.length > 0 ? (recentPresent / recent.length) * 100 : 0;
    const olderRate = older.length > 0 ? (olderPresent / older.length) * 100 : 0;
    const drop = olderRate - recentRate;

    const sortedByDate = [...attendanceData].sort((a, b) => {
      const sessionA = sessionMap.get(a.session_id);
      const sessionB = sessionMap.get(b.session_id);
      return (sessionB?.date || '').localeCompare(sessionA?.date || '');
    });
    let consecutiveAbsences = 0;
    for (const a of sortedByDate) {
      if (a.status === 'absent') consecutiveAbsences++;
      else break;
    }

    let severity = null;
    let pattern = null;
    let detail = null;

    if (consecutiveAbsences >= 3) {
      severity = 'critical';
      pattern = 'consecutive_absences';
      detail = `${studentName} has ${consecutiveAbsences} consecutive absences`;
    } else if (drop > 30) {
      severity = 'critical';
      pattern = 'sharp_decline';
      detail = `${studentName}'s attendance dropped ${drop.toFixed(0)}pp (${olderRate.toFixed(0)}% → ${recentRate.toFixed(0)}%)`;
    } else if (drop > 15) {
      severity = 'warning';
      pattern = 'moderate_decline';
      detail = `${studentName}'s attendance declined ${drop.toFixed(0)}pp (${olderRate.toFixed(0)}% → ${recentRate.toFixed(0)}%)`;
    }

    if (severity) {
      anomalies.push({
        student_id: studentId,
        student_name: studentName,
        pattern,
        severity,
        detail,
        recent_rate: Math.round(recentRate),
        older_rate: Math.round(olderRate),
        consecutive_absences: consecutiveAbsences,
      });
    }
  }

  anomalies.sort((a, b) => (a.severity === 'critical' ? -1 : 1));

  return anomalies;
}

// ── Detect grade anomalies ─────────────────────────────────────
async function detectGradeAnomalies(teacherId) {
  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select(`
      id,
      student_id,
      students(name),
      group:groups!inner(offering:offerings!inner(teacher_id))
    `)
    .eq('group.offering.teacher_id', teacherId);

  if (!enrollments || enrollments.length === 0) return [];

  const enrollmentIds = enrollments.map(e => e.id);
  const { data: allGrades } = await supabaseAdmin
    .from('grades').select(`
      enrollment_id,
      score,
      assessment:assessments(name, date, max_score)
    `)
    .in('enrollment_id', enrollmentIds)
    .order('assessment.date', { ascending: true });

  const gradesByEnrollment = new Map();
  for (const grade of (allGrades || [])) {
    if (!gradesByEnrollment.has(grade.enrollment_id)) gradesByEnrollment.set(grade.enrollment_id, []);
    gradesByEnrollment.get(grade.enrollment_id).push(grade);
  }

  const anomalies = [];

  for (const enrollment of enrollments) {
    const studentId = enrollment.student_id;
    const studentName = enrollment.students?.name || 'Student';

    const grades = (gradesByEnrollment.get(enrollment.id) || []).slice(-5);

    if (grades.length < 2) continue;

    const percentages = grades
      .filter(g => g.assessment?.max_score)
      .map(g => (g.score / g.assessment.max_score) * 100);

    if (percentages.length < 2) continue;

    const n = percentages.length;
    const xMean = (n - 1) / 2;
    const yMean = percentages.reduce((a, b) => a + b, 0) / n;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (percentages[i] - yMean);
      denominator += (i - xMean) ** 2;
    }
    const slope = denominator !== 0 ? numerator / denominator : 0;
    const avg = yMean;
    const suddenDrop = percentages.some(p => avg - p > 20);

    let severity = null;
    let pattern = null;
    let detail = null;

    if (suddenDrop) {
      severity = 'critical';
      pattern = 'sudden_drop';
      const lowest = Math.min(...percentages);
      detail = `${studentName} scored ${lowest.toFixed(0)}%, far below their average of ${avg.toFixed(0)}%`;
    } else if (slope < -10) {
      severity = 'warning';
      pattern = 'declining_trend';
      detail = `${studentName}'s grades declining at ${Math.abs(slope).toFixed(1)} points per assessment`;
    }

    if (severity) {
      anomalies.push({
        student_id: studentId,
        student_name: studentName,
        pattern,
        severity,
        detail,
        average: Math.round(avg * 10) / 10,
        slope: Math.round(slope * 10) / 10,
        latest_score: percentages[percentages.length - 1]?.toFixed(1) || null,
      });
    }
  }

  anomalies.sort((a, b) => (a.severity === 'critical' ? -1 : 1));

  return anomalies;
}

module.exports = {
  detectAttendanceAnomalies,
  detectGradeAnomalies,
};
