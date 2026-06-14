const cron = require('node-cron');
const { supabaseAdmin } = require('../config/database');
const alertEvaluator = require('./alertEvaluator');
const anomalyDetector = require('./anomalyDetector');
const weeklyDigest = require('./weeklyDigest');
const logger = require('./logger');

const tasks = [];

// ── Weekly digest: Sundays at 8 AM Cairo (6:00 UTC) ────────────
async function generateAllDigests() {
  try {
    logger.info('Cron: generating weekly digests');

    const { data: teachers } = await supabaseAdmin
      .from('teachers')
      .select('id')
      .in('subscription_tier', ['pro', 'center']);

    if (!teachers || teachers.length === 0) return;

    // Calculate last Monday and Sunday
    const now = new Date();
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - now.getDay());
    const lastMonday = new Date(lastSunday);
    lastMonday.setDate(lastSunday.getDate() - 6);

    const weekStart = lastMonday.toISOString().split('T')[0];
    const weekEnd = lastSunday.toISOString().split('T')[0];

    for (const teacher of teachers) {
      try {
        await weeklyDigest.generateDigest(teacher.id, weekStart, weekEnd);
      } catch (err) {
        logger.error('Cron: digest generation failed for teacher', { teacherId: teacher.id, error: err.message });
      }
    }

    logger.info('Cron: weekly digests completed', { teacherCount: teachers.length });
  } catch (error) {
    logger.error('Cron: generateAllDigests error', { error: error.message });
  }
}

// ── Alert evaluation: every 30 minutes ─────────────────────────
async function evaluateAllAlerts() {
  try {
    logger.info('Cron: evaluating alert rules');

    const { data: teacherRows } = await supabaseAdmin
      .from('alert_rules')
      .select('teacher_id')
      .eq('is_enabled', true);

    if (!teacherRows || teacherRows.length === 0) return;

    const uniqueTeacherIds = [...new Set(teacherRows.map(r => r.teacher_id))];

    for (const teacherId of uniqueTeacherIds) {
      try {
        await alertEvaluator.evaluateAllRules(teacherId);
      } catch (err) {
        logger.error('Cron: alert evaluation failed for teacher', { teacherId, error: err.message });
      }
    }

    logger.info('Cron: alert evaluation completed', { teacherCount: uniqueTeacherIds.length });
  } catch (error) {
    logger.error('Cron: evaluateAllAlerts error', { error: error.message });
  }
}

// ── Anomaly detection: daily at 6 AM Cairo (4:00 UTC) ──────────
async function detectAllAnomalies() {
  try {
    logger.info('Cron: running anomaly detection');

    const { data: teachers } = await supabaseAdmin
      .from('teachers')
      .select('id')
      .in('subscription_tier', ['pro', 'center']);

    if (!teachers || teachers.length === 0) return;

    for (const teacher of teachers) {
      try {
        const attendanceAnomalies = await anomalyDetector.detectAttendanceAnomalies(teacher.id);
        const gradeAnomalies = await anomalyDetector.detectGradeAnomalies(teacher.id);
        const allAnomalies = [...attendanceAnomalies, ...gradeAnomalies];

        for (const anomaly of allAnomalies) {
          if (anomaly.severity === 'critical') {
            await supabaseAdmin.from('alerts').insert([{
              teacher_id: teacher.id,
              student_id: anomaly.student_id,
              alert_type: 'trend_anomaly',
              title: `Anomaly: ${anomaly.student_name}`,
              message: anomaly.detail,
              severity: 'critical',
              metadata: { pattern: anomaly.pattern, source: 'anomaly_detector' },
            }]);
          }
        }
      } catch (err) {
        logger.error('Cron: anomaly detection failed for teacher', { teacherId: teacher.id, error: err.message });
      }
    }

    logger.info('Cron: anomaly detection completed', { teacherCount: teachers.length });
  } catch (error) {
    logger.error('Cron: detectAllAnomalies error', { error: error.message });
  }
}

// ── Start all cron jobs ────────────────────────────────────────
function startCronJobs() {
  // Weekly digest: Sundays at 8 AM Cairo (6:00 UTC)
  tasks.push(cron.schedule('0 6 * * 0', generateAllDigests));

  // Alert evaluation: every 30 minutes
  tasks.push(cron.schedule('*/30 * * * *', evaluateAllAlerts));

  // Anomaly detection: daily at 6 AM Cairo (4:00 UTC)
  tasks.push(cron.schedule('0 4 * * *', detectAllAnomalies));

  logger.info('Cron jobs started', { count: tasks.length });
}

// ── Graceful shutdown ──────────────────────────────────────────
function stopCronJobs() {
  tasks.forEach(task => task.stop());
  tasks.length = 0;
  logger.info('Cron jobs stopped');
}

module.exports = {
  startCronJobs,
  stopCronJobs,
};
