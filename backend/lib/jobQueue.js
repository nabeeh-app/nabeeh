const crypto = require('crypto');
const logger = require('./logger');

const jobs = new Map();

// Job handlers — add new types here
const handlers = {
  'bulk-report': async (payload) => {
    const { supabaseAdmin } = require('../config/database');
    const aiService = require('./aiService');

    const { teacherId, group_id } = payload;

    const { data: enrollments } = await supabaseAdmin
      .from('enrollments')
      .select('student_id, students(name)')
      .eq('group_id', group_id);

    if (!enrollments || enrollments.length === 0) return { drafts: [], total: 0, generated: 0 };

    const CONCURRENCY = 3;
    const results = [];

    for (let i = 0; i < enrollments.length; i += CONCURRENCY) {
      const batch = enrollments.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(async (enrollment) => {
        try {
          const gradesResult = await require('./whatsappQuery').getStudentGrades(enrollment.student_id);
          const attendanceRecords = await require('./whatsappQuery').getAllStudentAttendance(enrollment.student_id);
          const totalSessions = attendanceRecords.length;
          const presentCount = attendanceRecords.filter(a => a.status === 'present' || a.status === 'late').length;
          const attendanceRate = totalSessions > 0 ? `${Math.round((presentCount / totalSessions) * 100)}%` : 'N/A';

          const draftText = await aiService.generateReportComment({
            studentName: enrollment.students?.name || 'Student',
            grades: gradesResult?.recentGrades || [],
            attendance: { total_sessions: totalSessions, present: presentCount, rate: attendanceRate },
            trends: 'Steady improvement',
            language: 'en',
          }, { teacherName: 'Teacher', businessName: '' });

          const { data: draft } = await supabaseAdmin
            .from('report_drafts')
            .insert([{
              teacher_id: teacherId,
              student_id: enrollment.student_id,
              group_id,
              draft_text: draftText,
              data_sources: { grades: gradesResult?.recentGrades || [] },
              status: 'pending',
            }])
            .select().single();

          return draft || null;
        } catch (e) {
          logger.error('Job bulk-report student error', { studentId: enrollment.student_id, error: e.message });
          return null;
        }
      }));
      results.push(...batchResults);
    }

    const drafts = results.filter(Boolean);
    return { drafts, total: enrollments.length, generated: drafts.length };
  },
};

function createJob(type, payload) {
  const id = crypto.randomUUID();
  const job = { id, type, payload, status: 'pending', result: null, error: null, created_at: new Date().toISOString() };
  jobs.set(id, job);
  processJob(id).catch(err => {
    logger.error('Job processing failed', { jobId: id, error: err.message });
  });
  return id;
}

function getJob(id) {
  return jobs.get(id) || null;
}

async function processJob(id) {
  const job = jobs.get(id);
  if (!job) return;

  job.status = 'processing';
  try {
    const handler = handlers[job.type];
    if (!handler) throw new Error(`Unknown job type: ${job.type}`);
    job.result = await handler(job.payload);
    job.status = 'completed';
  } catch (err) {
    job.status = 'failed';
    job.error = err.message;
    logger.error('Job failed', { jobId: id, type: job.type, error: err.message });
  }
}

module.exports = { createJob, getJob };
