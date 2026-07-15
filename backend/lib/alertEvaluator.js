const { supabaseAdmin } = require('../config/database');
const anomalyDetector = require('./anomalyDetector');
const logger = require('./logger');

// ── Comparison helpers ─────────────────────────────────────────
function compare(value, op, threshold) {
  switch (op) {
    case 'gt':  return value > threshold;
    case 'lt':  return value < threshold;
    case 'gte': return value >= threshold;
    case 'lte': return value <= threshold;
    default:    return false;
  }
}

// ── Deduplication: skip if same alert exists within 24h ───────
async function hasRecentDuplicate(teacherId, studentId, alertType) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from('alerts')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('student_id', studentId)
    .eq('alert_type', alertType)
    .gte('created_at', cutoff)
    .limit(1);

  return data && data.length > 0;
}

// ── Create alert + notification ────────────────────────────────
async function createAlert({ teacherId, studentId, alertRuleId, alertType, title, message, severity, metadata, notificationMethod }) {
  // Insert alert
  const { data: alert, error } = await supabaseAdmin
    .from('alerts')
    .insert([{
      teacher_id: teacherId,
      student_id: studentId || null,
      alert_rule_id: alertRuleId || null,
      alert_type: alertType,
      title,
      message,
      severity: severity || 'warning',
      metadata: metadata || {},
    }])
    .select()
    .single();

  if (error) {
    logger.error('Failed to create alert', { error: error.message });
    return null;
  }

  // Create in-app notification
  if (notificationMethod === 'in_app' || notificationMethod === 'both') {
    await supabaseAdmin
      .from('notifications')
      .insert([{
        teacher_id: teacherId,
        type: 'alert',
        title,
        body: message,
        entity_type: 'alert',
        entity_id: alert.id,
      }]);
  }

  logger.info('Alert created', { alertId: alert.id, alertType, severity, teacherId });
  return alert;
}

// ── Check attendance threshold ─────────────────────────────────
async function checkAttendanceThreshold(rule, teacherId) {
  // Get all enrolled students in teacher's groups
  const { data: enrollments } = await supabaseAdmin
    .from('enrollments')
    .select(`
      id,
      student_id,
      students(name),
      group:groups!inner(
        id,
        offering:offerings!inner(teacher_id)
      )
    `)
    .eq('group.offering.teacher_id', teacherId);

  if (!enrollments || enrollments.length === 0) return;

  for (const enrollment of enrollments) {
    const studentId = enrollment.student_id;
    const studentName = enrollment.students?.name || 'Student';

    // Count total sessions and absences
    const { data: attendanceData } = await supabaseAdmin
      .from('attendance')
      .select('status')
      .eq('enrollment_id', enrollment.id);

    if (!attendanceData || attendanceData.length === 0) continue;

    const totalSessions = attendanceData.length;
    const absences = attendanceData.filter(a => a.status === 'absent').length;

    if (compare(absences, rule.comparison, rule.threshold_value)) {
      const deduped = await hasRecentDuplicate(teacherId, studentId, 'attendance_threshold');
      if (deduped) continue;

      await createAlert({
        teacherId,
        studentId,
        alertRuleId: rule.id,
        alertType: 'attendance_threshold',
        title: `High Absences: ${studentName}`,
        message: `${studentName} has ${absences} absence(s) out of ${totalSessions} sessions (${((absences / totalSessions) * 100).toFixed(0)}%).`,
        severity: absences >= 5 ? 'critical' : 'warning',
        metadata: { absences, total_sessions: totalSessions, rate: ((absences / totalSessions) * 100).toFixed(1) },
        notificationMethod: rule.notification_method,
      });
    }
  }
}

// ── Check grade threshold ──────────────────────────────────────
async function checkGradeThreshold(rule, teacherId) {
  const { data: grades } = await supabaseAdmin
    .from('grades')
    .select(`
      score,
      assessment:assessments!inner(max_score, name),
      enrollment:enrollments!inner(
        student_id,
        students(name),
        group:groups!inner(
          offering:offerings!inner(teacher_id)
        )
      )
    `)
    .eq('enrollment.group.offering.teacher_id', teacherId);

  if (!grades || grades.length === 0) return;

  // Group by student
  const byStudent = {};
  grades.forEach(g => {
    const sid = g.enrollment?.student_id;
    if (!sid) return;
    if (!byStudent[sid]) byStudent[sid] = { name: g.enrollment?.students?.name || 'Student', scores: [] };
    const pct = g.assessment?.max_score ? (g.score / g.assessment.max_score) * 100 : 0;
    byStudent[sid].scores.push(pct);
  });

  for (const [studentId, data] of Object.entries(byStudent)) {
    const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;

    if (compare(avg, rule.comparison, rule.threshold_value)) {
      const deduped = await hasRecentDuplicate(teacherId, studentId, 'grade_threshold');
      if (deduped) continue;

      await createAlert({
        teacherId,
        studentId,
        alertRuleId: rule.id,
        alertType: 'grade_threshold',
        title: `Low Grades: ${data.name}`,
        message: `${data.name}'s average score is ${avg.toFixed(1)}%, which is below the threshold of ${rule.threshold_value}%.`,
        severity: avg < 40 ? 'critical' : 'warning',
        metadata: { average: avg.toFixed(1), threshold: rule.threshold_value, assessments_count: data.scores.length },
        notificationMethod: rule.notification_method,
      });
    }
  }
}

// ── Check trend anomaly (delegates to anomalyDetector) ─────────
async function checkTrendAnomaly(rule, teacherId) {
  const anomalies = await anomalyDetector.detectAttendanceAnomalies(teacherId);

  for (const anomaly of anomalies) {
    const deduped = await hasRecentDuplicate(teacherId, anomaly.student_id, 'trend_anomaly');
    if (deduped) continue;

    await createAlert({
      teacherId,
      studentId: anomaly.student_id,
      alertRuleId: rule.id,
      alertType: 'trend_anomaly',
      title: `${anomaly.pattern === 'consecutive_absences' ? 'Consecutive Absences' : anomaly.severity === 'critical' ? 'Attendance Drop' : 'Attendance Decline'}: ${anomaly.student_name}`,
      message: anomaly.detail,
      severity: anomaly.severity,
      metadata: { pattern: anomaly.pattern, recent_rate: anomaly.recent_rate, older_rate: anomaly.older_rate, source: 'anomaly_detector' },
      notificationMethod: rule.notification_method,
    });
  }
}

// ── Evaluate a single rule ─────────────────────────────────────
async function evaluateRule(rule, teacherId) {
  try {
    switch (rule.alert_type) {
      case 'attendance_threshold':
        await checkAttendanceThreshold(rule, teacherId);
        break;
      case 'grade_threshold':
        await checkGradeThreshold(rule, teacherId);
        break;
      case 'trend_anomaly':
        await checkTrendAnomaly(rule, teacherId);
        break;
      default:
        logger.warn('Unknown alert type', { alertType: rule.alert_type });
    }
  } catch (error) {
    logger.error('Error evaluating rule', { error: error.message, ruleId: rule.id });
  }
}

// ── Evaluate all rules for a teacher ───────────────────────────
async function evaluateAllRules(teacherId) {
  const { data: rules } = await supabaseAdmin
    .from('alert_rules')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('is_enabled', true);

  if (!rules || rules.length === 0) return;

  for (const rule of rules) {
    await evaluateRule(rule, teacherId);
  }
}

module.exports = {
  evaluateAllRules,
  evaluateRule,
  checkAttendanceThreshold,
  checkGradeThreshold,
  checkTrendAnomaly,
};
