const { supabaseAdmin } = require('../config/database');
const logger = require('./logger');

// ── Detect attendance anomalies ────────────────────────────────
async function detectAttendanceAnomalies(teacherId) {
  // Get all enrolled students in teacher's groups
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

  const anomalies = [];

  for (const enrollment of enrollments) {
    const studentId = enrollment.student_id;
    const studentName = enrollment.students?.name || 'Student';

    // Get last 10 sessions
    const { data: sessions } = await supabaseAdmin
      .from('sessions')
      .select('id, date')
      .eq('group_id', enrollment.group?.id)
      .order('date', { ascending: false })
      .limit(10);

    if (!sessions || sessions.length < 5) continue;

    const sessionIds = sessions.map(s => s.id);
    const { data: attendanceData } = await supabaseAdmin
      .from('attendance')
      .select('status, session_id')
      .eq('enrollment_id', enrollment.id)
      .in('session_id', sessionIds);

    if (!attendanceData || attendanceData.length === 0) continue;

    // Split: last 3 vs prior 7
    const recentCount = Math.min(3, attendanceData.length);
    const recent = attendanceData.slice(0, recentCount);
    const older = attendanceData.slice(recentCount);

    const recentPresent = recent.filter(a => a.status === 'present').length;
    const olderPresent = older.length > 0 ? older.filter(a => a.status === 'present').length : 0;

    const recentRate = recent.length > 0 ? (recentPresent / recent.length) * 100 : 0;
    const olderRate = older.length > 0 ? (olderPresent / older.length) * 100 : 0;
    const drop = olderRate - recentRate;

    // Check for consecutive absences
    const sortedByDate = [...attendanceData].sort((a, b) => {
      const sessionA = sessions.find(s => s.id === a.session_id);
      const sessionB = sessions.find(s => s.id === b.session_id);
      return (sessionB?.date || 0) - (sessionA?.date || 0);
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

  // Sort: critical first
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

  const anomalies = [];

  for (const enrollment of enrollments) {
    const studentId = enrollment.student_id;
    const studentName = enrollment.students?.name || 'Student';

    // Get last 5 grades ordered by assessment date
    const { data: grades } = await supabaseAdmin
      .from('grades')
      .select(`
        score,
        assessment:assessments(name, date, max_score)
      `)
      .eq('enrollment_id', enrollment.id)
      .order('assessment.date', { ascending: true })
      .limit(5);

    if (!grades || grades.length < 2) continue;

    const percentages = grades
      .filter(g => g.assessment?.max_score)
      .map(g => (g.score / g.assessment.max_score) * 100);

    if (percentages.length < 2) continue;

    // Calculate trend (simple slope)
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

    // Calculate average
    const avg = yMean;

    // Check for sudden drop: any score > 20 points below average
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
