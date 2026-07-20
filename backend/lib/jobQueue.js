const crypto = require('crypto');
const logger = require('./logger');
const { supabaseAdmin } = require('../config/database');
const aiService = require('./aiService');
const whatsappQuery = require('./whatsappQuery');

const jobs = new Map();

// How long to keep completed/failed jobs before cleanup (milliseconds)
const JOB_TTL = 5 * 60 * 1000;

// Periodic cleanup interval for stale entries (every 10 minutes)
const CLEANUP_INTERVAL = 10 * 60 * 1000;

// Schedule periodic cleanup of stale jobs
setInterval(() => {
  const cutoff = Date.now() - JOB_TTL;
  let cleaned = 0;
  for (const [id, job] of jobs) {
    if (new Date(job.updated_at || job.created_at).getTime() < cutoff) {
      jobs.delete(id);
      cleaned++;
    }
  }
  if (cleaned > 0) logger.info('Job queue cleanup', { removed: cleaned, remaining: jobs.size });
}, CLEANUP_INTERVAL).unref();

function scheduleCleanup(id) {
  setTimeout(() => {
    jobs.delete(id);
  }, JOB_TTL).unref();
}

// Job handlers — add new types here
const handlers = {
  'bulk-report': async (payload) => {
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
          const gradesResult = await whatsappQuery.getStudentGrades(enrollment.student_id);
          const attendanceRecords = await whatsappQuery.getAllStudentAttendance(enrollment.student_id);
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
  const now = new Date().toISOString();
  const job = { id, type, payload, status: 'pending', result: null, error: null, created_at: now, updated_at: now };
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
    job.updated_at = new Date().toISOString();
    scheduleCleanup(id);
  } catch (err) {
    job.status = 'failed';
    job.error = err.message;
    job.updated_at = new Date().toISOString();
    scheduleCleanup(id);
    logger.error('Job failed', { jobId: id, type: job.type, error: err.message });
  }
}

module.exports = { createJob, getJob };
