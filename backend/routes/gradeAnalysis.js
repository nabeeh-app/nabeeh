const express = require('express');
const { z } = require('zod');
const { supabaseAdmin } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../lib/logger');

const router = express.Router();

// ── Zod Schemas ────────────────────────────────────────────────
const groupComparisonSchema = z.object({
  query: z.object({
    offering_id: z.string().uuid(),
  }),
});

const atRiskSchema = z.object({
  query: z.object({
    offering_id: z.string().uuid(),
    grade_threshold: z.coerce.number().min(0).max(100).default(60),
    attendance_threshold: z.coerce.number().min(0).max(100).default(70),
  }),
});

const distributionSchema = z.object({
  params: z.object({ assessmentId: z.string().uuid() }),
});

const trendsSchema = z.object({
  params: z.object({ studentId: z.string().uuid() }),
});

const overviewSchema = z.object({
  params: z.object({ offeringId: z.string().uuid() }),
});

function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({ body: req.body, params: req.params, query: req.query });
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.error.issues[0].message, code: 'VALIDATION_ERROR' });
    }
    req.validated = result.data;
    next();
  };
}

// ── GET /group-comparison — Average scores per group for an offering ──
const getGroupComparison = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { offering_id } = req.validated.query;

    // Verify offering belongs to teacher
    const { data: offering } = await supabaseAdmin
      .from('offerings')
      .select('id')
      .eq('id', offering_id)
      .eq('teacher_id', teacherId)
      .single();

    if (!offering) return res.status(404).json({ success: false, message: 'Offering not found' });

    // Get groups with their enrollments and grades
    const { data: groups } = await supabaseAdmin
      .from('groups')
      .select(`
        id,
        name,
        enrollments(
          id,
          grades(score, assessment:assessments(max_score))
        )
      `)
      .eq('offering_id', offering_id);

    if (!groups) return res.json({ success: true, data: [] });

    const result = groups.map(group => {
      const enrollments = group.enrollments || [];
      const allScores = [];

      enrollments.forEach(e => {
        (e.grades || []).forEach(g => {
          if (g.assessment?.max_score) {
            allScores.push((g.score / g.assessment.max_score) * 100);
          }
        });
      });

      const avg = allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : 0;

      return {
        group_id: group.id,
        group_name: group.name,
        student_count: enrollments.length,
        average_score: Math.round(avg * 10) / 10,
        assessments_count: allScores.length,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Get group comparison error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching group comparison' });
  }
};

// ── GET /at-risk — Students with grades below threshold + poor attendance ──
const getAtRisk = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { offering_id, grade_threshold, attendance_threshold } = req.validated.query;

    // Verify offering belongs to teacher
    const { data: offering } = await supabaseAdmin
      .from('offerings')
      .select('id')
      .eq('id', offering_id)
      .eq('teacher_id', teacherId)
      .single();

    if (!offering) return res.status(404).json({ success: false, message: 'Offering not found' });

    // Get all enrollments in this offering with grades and attendance
    const { data: enrollments } = await supabaseAdmin
      .from('enrollments')
      .select(`
        id,
        student_id,
        students(name, student_id),
        group:groups(id),
        grades(score, assessment:assessments(max_score)),
        attendance(status)
      `)
      .eq('group.offering_id', offering_id);

    if (!enrollments) return res.json({ success: true, data: [] });

    const atRisk = [];

    for (const enrollment of enrollments) {
      const studentName = enrollment.students?.name || 'Student';
      const studentCode = enrollment.students?.student_id || '';

      // Calculate average grade
      const grades = enrollment.grades || [];
      const percentages = grades
        .filter(g => g.assessment?.max_score)
        .map(g => (g.score / g.assessment.max_score) * 100);

      const avgGrade = percentages.length > 0
        ? percentages.reduce((a, b) => a + b, 0) / percentages.length
        : null;

      // Calculate attendance rate
      const attendance = enrollment.attendance || [];
      const attended = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
      const attendanceRate = attendance.length > 0 ? (attended / attendance.length) * 100 : null;

      const gradeBelow = avgGrade !== null && avgGrade < grade_threshold;
      const attendanceBelow = attendanceRate !== null && attendanceRate < attendance_threshold;

      if (gradeBelow || attendanceBelow) {
        let severity = 'warning';
        if (gradeBelow && attendanceBelow) severity = 'critical';

        atRisk.push({
          student_id: enrollment.student_id,
          student_name: studentName,
          student_code: studentCode,
          average_grade: avgGrade !== null ? Math.round(avgGrade * 10) / 10 : null,
          attendance_rate: attendanceRate !== null ? Math.round(attendanceRate * 10) / 10 : null,
          severity,
          grade_below_threshold: gradeBelow,
          attendance_below_threshold: attendanceBelow,
        });
      }
    }

    // Sort: critical first, then by average grade ascending
    atRisk.sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
      return (a.average_grade || 0) - (b.average_grade || 0);
    });

    res.json({ success: true, data: atRisk });
  } catch (error) {
    logger.error('Get at-risk students error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching at-risk students' });
  }
};

// ── GET /distribution/:assessmentId — Grade distribution histogram ──
const getDistribution = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { assessmentId } = req.validated.params;

    // Verify assessment belongs to teacher
    const { data: assessment } = await supabaseAdmin
      .from('assessments')
      .select('id, name, max_score, offering:offerings(teacher_id)')
      .eq('id', assessmentId)
      .single();

    if (!assessment || assessment.offering?.teacher_id !== teacherId) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    // Get all grades for this assessment
    const { data: grades } = await supabaseAdmin
      .from('grades')
      .select('score')
      .eq('assessment_id', assessmentId);

    if (!grades || grades.length === 0) {
      return res.json({
        success: true,
        data: {
          assessment_name: assessment.name,
          max_score: assessment.max_score,
          total_students: 0,
          distribution: [],
          average: 0,
          median: 0,
        },
      });
    }

    const maxScore = assessment.max_score || 100;
    const percentages = grades.map(g => (g.score / maxScore) * 100);

    // Build histogram buckets: 0-10, 10-20, ..., 90-100
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}-${(i + 1) * 10}`,
      min: i * 10,
      max: (i + 1) * 10,
      count: 0,
    }));

    percentages.forEach(pct => {
      const idx = Math.min(Math.floor(pct / 10), 9);
      buckets[idx].count++;
    });

    const sorted = [...percentages].sort((a, b) => a - b);
    const median = sorted.length > 0
      ? sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]
      : 0;

    res.json({
      success: true,
      data: {
        assessment_name: assessment.name,
        max_score: maxScore,
        total_students: grades.length,
        distribution: buckets,
        average: Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 10) / 10,
        median: Math.round(median * 10) / 10,
      },
    });
  } catch (error) {
    logger.error('Get grade distribution error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching grade distribution' });
  }
};

// ── GET /trends/:studentId — Grade trend over time for a student ──
const getTrends = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { studentId } = req.validated.params;

    // Get grades for this student, joined through enrollment -> offering -> teacher
    const { data: grades } = await supabaseAdmin
      .from('grades')
      .select(`
        score,
        assessment:assessments(name, date, max_score, offering:offerings(teacher_id))
      `)
      .eq('enrollment.student_id', studentId)
      .eq('assessment.offerings.teacher_id', teacherId)
      .order('assessment.date', { ascending: true });

    if (!grades || grades.length === 0) {
      return res.json({ success: true, data: { student_id: studentId, trends: [] } });
    }

    const trends = grades
      .filter(g => g.assessment?.max_score)
      .map(g => ({
        assessment_name: g.assessment.name,
        date: g.assessment.date,
        score: g.score,
        max_score: g.assessment.max_score,
        percentage: Math.round((g.score / g.assessment.max_score) * 100 * 10) / 10,
      }));

    res.json({ success: true, data: { student_id: studentId, trends } });
  } catch (error) {
    logger.error('Get grade trends error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching grade trends' });
  }
};

// ── GET /overview/:offeringId — Aggregate stats for offering ──
const getOverview = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { offeringId } = req.validated.params;

    // Verify offering belongs to teacher
    const { data: offering } = await supabaseAdmin
      .from('offerings')
      .select('id, subject:subjects(name), grade_level:grade_levels(name)')
      .eq('id', offeringId)
      .eq('teacher_id', teacherId)
      .single();

    if (!offering) return res.status(404).json({ success: false, message: 'Offering not found' });

    // Get all grades in this offering
    const { data: grades } = await supabaseAdmin
      .from('grades')
      .select(`
        score,
        assessment:assessments(name, max_score),
        enrollment:enrollments(student_id, students(name))
      `)
      .eq('assessment.offerings.id', offeringId);

    // Get enrollment count
    const { count: studentCount } = await supabaseAdmin
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('group.offering_id', offeringId);

    const allPercentages = (grades || [])
      .filter(g => g.assessment?.max_score)
      .map(g => (g.score / g.assessment.max_score) * 100);

    const avg = allPercentages.length > 0
      ? allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length
      : 0;

    const sorted = [...allPercentages].sort((a, b) => a - b);
    const median = sorted.length > 0
      ? sorted.length % 2 === 0
        ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
        : sorted[Math.floor(sorted.length / 2)]
      : 0;

    const passCount = allPercentages.filter(p => p >= 50).length;
    const passRate = allPercentages.length > 0 ? (passCount / allPercentages.length) * 100 : 0;

    res.json({
      success: true,
      data: {
        offering_id: offeringId,
        subject: offering.subject?.name || null,
        grade_level: offering.grade_level?.name || null,
        total_students: studentCount || 0,
        total_grades: allPercentages.length,
        average: Math.round(avg * 10) / 10,
        median: Math.round(median * 10) / 10,
        pass_rate: Math.round(passRate * 10) / 10,
        highest: sorted.length > 0 ? Math.round(sorted[sorted.length - 1] * 10) / 10 : 0,
        lowest: sorted.length > 0 ? Math.round(sorted[0] * 10) / 10 : 0,
      },
    });
  } catch (error) {
    logger.error('Get grade overview error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching grade overview' });
  }
};

// ── Route Definitions ──────────────────────────────────────────
/**
 * @openapi
 * /api/grade-analysis/group-comparison:
 *   get:
 *     tags: [Grade Analysis]
 *     summary: Group comparison
 *     description: Compare average scores across all groups within an offering. Returns per-group student count, average score, and assessment count.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: offering_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Offering ID to compare groups for
 *     responses:
 *       200:
 *         description: Group comparison data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       group_id:
 *                         type: string
 *                       group_name:
 *                         type: string
 *                       student_count:
 *                         type: integer
 *                       average_score:
 *                         type: number
 *                       assessments_count:
 *                         type: integer
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Offering not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/group-comparison', authenticateToken, validate(groupComparisonSchema), getGroupComparison);
/**
 * @openapi
 * /api/grade-analysis/at-risk:
 *   get:
 *     tags: [Grade Analysis]
 *     summary: At-risk students
 *     description: Identify students with grades below threshold or poor attendance within an offering. Returns severity (critical if both, warning if one).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: offering_id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Offering ID to check at-risk students for
 *       - in: query
 *         name: grade_threshold
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *           default: 60
 *         description: Minimum average grade percentage threshold
 *       - in: query
 *         name: attendance_threshold
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *           default: 70
 *         description: Minimum attendance rate percentage threshold
 *     responses:
 *       200:
 *         description: At-risk students list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       student_id:
 *                         type: string
 *                       student_name:
 *                         type: string
 *                       student_code:
 *                         type: string
 *                       average_grade:
 *                         type: number
 *                         nullable: true
 *                       attendance_rate:
 *                         type: number
 *                         nullable: true
 *                       severity:
 *                         type: string
 *                         enum: [warning, critical]
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Offering not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/at-risk', authenticateToken, validate(atRiskSchema), getAtRisk);
/**
 * @openapi
 * /api/grade-analysis/distribution/{assessmentId}:
 *   get:
 *     tags: [Grade Analysis]
 *     summary: Grade distribution
 *     description: Get a histogram of grade distribution for a specific assessment. Returns 10 buckets (0-10, 10-20, ..., 90-100) plus average and median.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assessmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Assessment ID
 *     responses:
 *       200:
 *         description: Grade distribution data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     assessment_name:
 *                       type: string
 *                     max_score:
 *                       type: number
 *                     total_students:
 *                       type: integer
 *                     distribution:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           range:
 *                             type: string
 *                           min:
 *                             type: integer
 *                           max:
 *                             type: integer
 *                           count:
 *                             type: integer
 *                     average:
 *                       type: number
 *                     median:
 *                       type: number
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Assessment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/distribution/:assessmentId', authenticateToken, validate(distributionSchema), getDistribution);
/**
 * @openapi
 * /api/grade-analysis/trends/{studentId}:
 *   get:
 *     tags: [Grade Analysis]
 *     summary: Grade trends
 *     description: Get grade trend over time for a specific student. Returns a chronological list of assessments with scores and percentages.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Student ID
 *     responses:
 *       200:
 *         description: Grade trends data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     student_id:
 *                       type: string
 *                     trends:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           assessment_name:
 *                             type: string
 *                           date:
 *                             type: string
 *                           score:
 *                             type: number
 *                           max_score:
 *                             type: number
 *                           percentage:
 *                             type: number
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/trends/:studentId', authenticateToken, validate(trendsSchema), getTrends);
/**
 * @openapi
 * /api/grade-analysis/overview/{offeringId}:
 *   get:
 *     tags: [Grade Analysis]
 *     summary: Offering overview
 *     description: 'Get aggregate grade statistics for an offering - total students, total grades, average, median, pass rate, highest, and lowest scores.'
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offeringId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Offering ID
 *     responses:
 *       200:
 *         description: Overview data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     offering_id:
 *                       type: string
 *                     subject:
 *                       type: string
 *                       nullable: true
 *                     grade_level:
 *                       type: string
 *                       nullable: true
 *                     total_students:
 *                       type: integer
 *                     total_grades:
 *                       type: integer
 *                     average:
 *                       type: number
 *                     median:
 *                       type: number
 *                     pass_rate:
 *                       type: number
 *                     highest:
 *                       type: number
 *                     lowest:
 *                       type: number
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Offering not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/overview/:offeringId', authenticateToken, validate(overviewSchema), getOverview);

module.exports = router;
