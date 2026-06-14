const { supabaseAdmin } = require('../config/database');
const anomalyDetector = require('./anomalyDetector');
const logger = require('./logger');

// ── Generate digest data for a teacher for a given week ────────
async function generateDigest(teacherId, weekStart, weekEnd) {
  try {
    // Get all enrollments in teacher's groups
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
      return { improved: [], declining: [], action_items: [], anomalies: [] };
    }

    const improved = [];
    const declining = [];

    for (const enrollment of enrollments) {
      const studentName = enrollment.students?.name || 'Student';

      // Get attendance for this week and prior week
      const { data: thisWeekAtt } = await supabaseAdmin
        .from('attendance')
        .select('status, session:sessions(date)')
        .eq('enrollment_id', enrollment.id)
        .gte('session.date', weekStart)
        .lte('session.date', weekEnd);

      const priorWeekStart = new Date(new Date(weekStart).getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const priorWeekEnd = new Date(new Date(weekStart).getTime() - 1).toISOString().split('T')[0];

      const { data: priorWeekAtt } = await supabaseAdmin
        .from('attendance')
        .select('status, session:sessions(date)')
        .eq('enrollment_id', enrollment.id)
        .gte('session.date', priorWeekStart)
        .lte('session.date', priorWeekEnd);

      const thisWeekRate = calcAttendanceRate(thisWeekAtt);
      const priorWeekRate = calcAttendanceRate(priorWeekAtt);
      const attChange = thisWeekRate - priorWeekRate;

      // Get grades for this week and prior week
      const { data: thisWeekGrades } = await supabaseAdmin
        .from('grades')
        .select('score, assessment:assessments(max_score, date)')
        .eq('enrollment_id', enrollment.id)
        .gte('assessment.date', weekStart)
        .lte('assessment.date', weekEnd);

      const { data: priorWeekGrades } = await supabaseAdmin
        .from('grades')
        .select('score, assessment:assessments(max_score, date)')
        .eq('enrollment_id', enrollment.id)
        .gte('assessment.date', priorWeekStart)
        .lte('assessment.date', priorWeekEnd);

      const thisWeekGradeAvg = calcGradeAverage(thisWeekGrades);
      const priorWeekGradeAvg = calcGradeAverage(priorWeekGrades);
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

    // Get anomalies
    const anomalies = await anomalyDetector.detectAttendanceAnomalies(teacherId);

    // Build action items
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

    // Store in weekly_digests
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
