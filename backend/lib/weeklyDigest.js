const { fetchEnrollmentData } = require('./batchQuery');
const anomalyDetector = require('./anomalyDetector');
const logger = require('./logger');
const { supabaseAdmin } = require('../config/database');

// ── Generate digest data for a teacher for a given week ────────
async function generateDigest(teacherId, weekStart, weekEnd) {
  try {
    const priorWeekStart = new Date(new Date(weekStart).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const priorWeekEnd = new Date(new Date(weekStart).getTime() - 1).toISOString().split('T')[0];

    // Batch fetch: enrollments + attendance + grades for the full 2-week window
    const { enrollments, attendance: allAttendance, grades: allGrades } = await fetchEnrollmentData(teacherId, {
      dateRange: { start: priorWeekStart, end: weekEnd },
    });

    if (enrollments.length === 0) {
      return { improved: [], declining: [], action_items: [], anomalies: [] };
    }

    const thisWeekAttByEnrollment = new Map();
    const priorWeekAttByEnrollment = new Map();
    for (const att of allAttendance) {
      const date = att.session?.date;
      if (!date) continue;
      const map = date >= weekStart && date <= weekEnd ? thisWeekAttByEnrollment : priorWeekAttByEnrollment;
      if (!map.has(att.enrollment_id)) map.set(att.enrollment_id, []);
      map.get(att.enrollment_id).push(att);
    }

    const thisWeekGradesByEnrollment = new Map();
    const priorWeekGradesByEnrollment = new Map();
    for (const grade of allGrades) {
      const date = grade.assessment?.date;
      if (!date) continue;
      const map = date >= weekStart && date <= weekEnd ? thisWeekGradesByEnrollment : priorWeekGradesByEnrollment;
      if (!map.has(grade.enrollment_id)) map.set(grade.enrollment_id, []);
      map.get(grade.enrollment_id).push(grade);
    }

    const improved = [];
    const declining = [];

    for (const enrollment of enrollments) {
      const studentName = enrollment.students?.name || 'Student';

      const thisWeekRate = calcAttendanceRate(thisWeekAttByEnrollment.get(enrollment.id));
      const priorWeekRate = calcAttendanceRate(priorWeekAttByEnrollment.get(enrollment.id));
      const attChange = thisWeekRate - priorWeekRate;

      const thisWeekGradeAvg = calcGradeAverage(thisWeekGradesByEnrollment.get(enrollment.id));
      const priorWeekGradeAvg = calcGradeAverage(priorWeekGradesByEnrollment.get(enrollment.id));
      const gradeChange = thisWeekGradeAvg - priorWeekGradeAvg;

      const entry = {
        student_id: enrollment.student_id,
        student_name: studentName,
        attendance_change: Math.round(attChange),
        grade_change: Math.round(gradeChange * 10) / 10,
        current_attendance: Math.round(thisWeekRate),
        current_grade_avg: Math.round(thisWeekGradeAvg * 10) / 10,
      };

      if (attChange > 10 || gradeChange > 5) {
        improved.push(entry);
      } else if (attChange < -10 || gradeChange < -5) {
        declining.push(entry);
      }
    }

    const anomalies = await anomalyDetector.detectAttendanceAnomalies(teacherId);

    const action_items = [];
    declining.forEach(d => {
      action_items.push({
        student_id: d.student_id,
        student_name: d.student_name,
        action: `Follow up with ${d.student_name} — attendance ${d.attendance_change}%, grades ${d.grade_change}pts`,
      });
    });
    anomalies.filter(a => a.severity === 'critical').forEach(a => {
      action_items.push({
        student_id: a.student_id,
        student_name: a.student_name,
        action: `Critical: ${a.detail}`,
      });
    });

    const digestData = {
      improved,
      declining,
      action_items,
      anomalies: anomalies.slice(0, 10),
      week_start: weekStart,
      week_end: weekEnd,
      generated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabaseAdmin
      .from('weekly_digests')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('week_start', weekStart)
      .limit(1);

    if (existing && existing.length > 0) {
      await supabaseAdmin
        .from('weekly_digests')
        .update({ digest_data: digestData })
        .eq('id', existing[0].id);
    } else {
      await supabaseAdmin
        .from('weekly_digests')
        .insert([{
          teacher_id: teacherId,
          week_start: weekStart,
          week_end: weekEnd,
          digest_data: digestData,
        }]);
    }

    logger.info('Weekly digest generated', { teacherId, weekStart, improved: improved.length, declining: declining.length });
    return digestData;
  } catch (error) {
    logger.error('Generate digest error', { error: error.message, teacherId });
    return { improved: [], declining: [], action_items: [], anomalies: [] };
  }
}

// ── Fetch most recent digest for teacher ───────────────────────
async function getLatestDigest(teacherId) {
  const { data } = await supabaseAdmin
    .from('weekly_digests')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('week_start', { ascending: false })
    .limit(1)
    .single();

  return data || null;
}

// ── Helpers ────────────────────────────────────────────────────
function calcAttendanceRate(records) {
  if (!records || records.length === 0) return 0;
  const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
  return (present / records.length) * 100;
}

function calcGradeAverage(grades) {
  if (!grades || grades.length === 0) return 0;
  const percentages = grades
    .filter(g => g.assessment?.max_score)
    .map(g => (g.score / g.assessment.max_score) * 100);
  if (percentages.length === 0) return 0;
  return percentages.reduce((a, b) => a + b, 0) / percentages.length;
}

module.exports = {
  generateDigest,
  getLatestDigest,
};
