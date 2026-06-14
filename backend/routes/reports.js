const express = require('express');
const { z } = require('zod');
const { supabaseAdmin } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logAudit } = require('../lib/auditLog');
const aiService = require('../lib/aiService');
const { createJob, getJob } = require('../lib/jobQueue');
const logger = require('../lib/logger');

const router = express.Router();

const generateCommentSchema = z.object({
  body: z.object({
    student_id: z.string().uuid(),
    group_id: z.string().uuid().optional(),
  }),
});

const draftParamsSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

const updateDraftSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    edited_text: z.string().min(1),
    status: z.enum(['pending', 'approved', 'edited', 'rejected']).optional(),
  }),
});

const bulkGenerateSchema = z.object({
  body: z.object({ group_id: z.string().uuid() }),
});

const generateComment = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { student_id, group_id } = req.body;

    const { data: student } = await supabaseAdmin
      .from('students').select('id, name').eq('id', student_id).single();
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const { data: enrollment } = await supabaseAdmin
      .from('enrollments')
      .select('id, groups!inner(id, offerings!inner(teacher_id))')
      .eq('student_id', student_id)
      .eq('groups.offerings.teacher_id', teacherId)
      .limit(1)
      .maybeSingle();
    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const { data: teacher } = await supabaseAdmin
      .from('teachers').select('name, business_name, preferred_language').eq('id', teacherId).single();

    const gradesResult = await require('../lib/whatsappQuery').getStudentGrades(student_id);
    const attendanceRecords = await require('../lib/whatsappQuery').getAllStudentAttendance(student_id);
    const totalSessions = attendanceRecords.length;
    const presentCount = attendanceRecords.filter(a => a.status === 'present' || a.status === 'late').length;
    const attendanceRate = totalSessions > 0 ? `${Math.round((presentCount / totalSessions) * 100)}%` : 'N/A';

    const draftText = await aiService.generateReportComment({
      studentName: student.name,
      grades: gradesResult?.recentGrades || [],
      attendance: { total_sessions: totalSessions, present: presentCount, rate: attendanceRate },
      trends: 'Steady improvement over recent weeks',
      language: teacher?.preferred_language || 'en',
    }, {
      teacherName: teacher?.name || 'Teacher',
      businessName: teacher?.business_name || '',
    });

    const { data: draft, error } = await supabaseAdmin
      .from('report_drafts')
      .insert([{
        teacher_id: teacherId,
        student_id,
        group_id: group_id || null,
        draft_text: draftText,
        data_sources: { grades: gradesResult?.recentGrades || [], attendance },
        status: 'pending',
      }])
      .select().single();

    if (error) throw error;

    await logAudit({
      actorId: teacherId, actorType: 'teacher', teacherId,
      action: 'report_comment_generated', entityType: 'report_draft',
      entityId: draft.id, ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: draft });
  } catch (error) {
    logger.error('Generate comment error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error generating comment' });
  }
};

const getDrafts = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('report_drafts')
      .select('*, students(name, student_id)', { count: 'exact' })
      .eq('teacher_id', teacherId);

    if (status) query = query.eq('status', status);
    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      success: true,
      data: (data || []).map(d => ({
        ...d,
        student_name: d.students?.name || null,
        student_code: d.students?.student_id || null,
        students: undefined,
      })),
      pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
    });
  } catch (error) {
    logger.error('Get drafts error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching drafts' });
  }
};

const updateDraft = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { id } = req.validated.params;
    const { edited_text, status } = req.validated.body;

    const updates = { edited_text };
    if (status) updates.status = status;
    else updates.status = 'edited';

    const { data, error } = await supabaseAdmin
      .from('report_drafts')
      .update(updates)
      .eq('id', id).eq('teacher_id', teacherId)
      .select().single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: 'Draft not found' });

    res.json({ success: true, data });
  } catch (error) {
    logger.error('Update draft error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error updating draft' });
  }
};

const approveDraft = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { id } = req.validated.params;

    const { data: draft } = await supabaseAdmin
      .from('report_drafts')
      .select('*, students(name, id)')
      .eq('id', id).eq('teacher_id', teacherId).single();

    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });

    const finalText = draft.edited_text || draft.draft_text;

    // Find student's parent
    const { data: parentLink } = await supabaseAdmin
      .from('student_parents')
      .select('parents(id, name, phone)')
      .eq('student_id', draft.student_id)
      .limit(1);

    if (parentLink && parentLink.length > 0) {
      const parent = parentLink[0].parents;

      // Try to send via WhatsApp
      try {
        const whatsappQuery = require('../lib/whatsappQuery');
        const conversation = await whatsappQuery.findOrCreateConversation(
          parent.id, teacherId, `report_${draft.id}`
        );
        if (conversation) {
          await whatsappQuery.saveMessage(conversation.id, 'outbound', finalText);
        }
      } catch (waError) {
        logger.warn('WhatsApp send failed for report', { error: waError.message });
      }
    }

    // Update draft status
    await supabaseAdmin
      .from('report_drafts')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', id);

    // Create notification
    await supabaseAdmin
      .from('notifications')
      .insert([{
        teacher_id: teacherId,
        type: 'report_ready',
        title: 'Report Sent',
        body: `Report comment sent for ${draft.students?.name || 'student'}`,
        entity_type: 'report',
        entity_id: draft.id,
      }]);

    await logAudit({
      actorId: teacherId, actorType: 'teacher', teacherId,
      action: 'report_sent', entityType: 'report_draft',
      entityId: draft.id, ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Report approved and sent' });
  } catch (error) {
    logger.error('Approve draft error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error approving draft' });
  }
};

const rejectDraft = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { id } = req.validated.params;
    const { error } = await supabaseAdmin
      .from('report_drafts')
      .update({ status: 'rejected' })
      .eq('id', id).eq('teacher_id', teacherId);
    if (error) throw error;
    res.json({ success: true, message: 'Draft rejected' });
  } catch (error) {
    logger.error('Reject draft error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error rejecting draft' });
  }
};

const bulkGenerate = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { group_id } = req.body;

    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('id, offerings!inner(teacher_id)')
      .eq('id', group_id)
      .eq('offerings.teacher_id', teacherId)
      .maybeSingle();
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    const jobId = createJob('bulk-report', { teacherId, group_id });
    res.status(202).json({ success: true, data: { job_id: jobId, status: 'pending' } });
  } catch (error) {
    logger.error('Bulk generate error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error in bulk generation' });
  }
};

const getLatestDigest = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { data } = await supabaseAdmin
      .from('weekly_digests')
      .select('*')
      .eq('teacher_id', teacherId)
      .order('week_start', { ascending: false })
      .limit(1)
      .single();

    res.json({ success: true, data: data || null });
  } catch (error) {
    logger.error('Get latest digest error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching digest' });
  }
};

const getDigestByWeek = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { weekStart } = req.params;
    const { data } = await supabaseAdmin
      .from('weekly_digests')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('week_start', weekStart)
      .single();

    if (!data) return res.status(404).json({ success: false, message: 'Digest not found for this week' });
    res.json({ success: true, data });
  } catch (error) {
    logger.error('Get digest by week error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching digest' });
  }
};

/**
 * @openapi
 * /api/reports/generate-comment:
 *   post:
 *     tags: [Reports]
 *     summary: Generate AI comment
 *     description: Generate an AI-powered report comment for a specific student. The comment is saved as a draft for review.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [student_id]
 *             properties:
 *               student_id:
 *                 type: string
 *                 format: uuid
 *                 description: The student to generate a comment for
 *               group_id:
 *                 type: string
 *                 format: uuid
 *                 description: Optional group ID for context
 *     responses:
 *       201:
 *         description: Draft comment generated
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
 *         description: Student not found
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
router.post('/generate-comment', authenticateToken, validate(generateCommentSchema), generateComment);
/**
 * @openapi
 * /api/reports/drafts:
 *   get:
 *     tags: [Reports]
 *     summary: List drafts
 *     description: Retrieve paginated report drafts for the authenticated teacher. Supports filtering by status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, edited, rejected, sent]
 *         description: Filter by draft status
 *     responses:
 *       200:
 *         description: Drafts retrieved
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
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
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
router.get('/drafts', authenticateToken, getDrafts);
/**
 * @openapi
 * /api/reports/drafts/{id}:
 *   put:
 *     tags: [Reports]
 *     summary: Update draft
 *     description: Update a report draft's text and/or status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Draft ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [edited_text]
 *             properties:
 *               edited_text:
 *                 type: string
 *                 minLength: 1
 *                 description: The edited report text
 *               status:
 *                 type: string
 *                 enum: [pending, approved, edited, rejected]
 *                 description: New status for the draft
 *     responses:
 *       200:
 *         description: Draft updated
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
 *         description: Draft not found
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
router.put('/drafts/:id', authenticateToken, validate(updateDraftSchema), updateDraft);
/**
 * @openapi
 * /api/reports/drafts/{id}/approve:
 *   post:
 *     tags: [Reports]
 *     summary: Approve and send draft
 *     description: Approve a report draft and send it to the student's parent via WhatsApp. Creates a notification and logs the action.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Draft ID
 *     responses:
 *       200:
 *         description: Report approved and sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Draft not found
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
router.post('/drafts/:id/approve', authenticateToken, validate(draftParamsSchema), approveDraft);
/**
 * @openapi
 * /api/reports/drafts/{id}/reject:
 *   post:
 *     tags: [Reports]
 *     summary: Reject draft
 *     description: Reject a report draft. The draft is preserved but marked as rejected.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Draft ID
 *     responses:
 *       200:
 *         description: Draft rejected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
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
router.post('/drafts/:id/reject', authenticateToken, validate(draftParamsSchema), rejectDraft);
/**
 * @openapi
 * /api/reports/bulk-generate:
 *   post:
 *     tags: [Reports]
 *     summary: Bulk generate
 *     description: Generate AI report comments for all students in a group. Each student gets a separate draft.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [group_id]
 *             properties:
 *               group_id:
 *                 type: string
 *                 format: uuid
 *                 description: The group to generate reports for
 *     responses:
 *       202:
 *         description: Bulk generation job started
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
 *                     job_id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: pending
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
 *         description: No students found in group
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
router.post('/bulk-generate', authenticateToken, validate(bulkGenerateSchema), bulkGenerate);
/**
 * @openapi
 * /api/reports/weekly-digest:
 *   get:
 *     tags: [Reports]
 *     summary: Get latest digest
 *     description: Retrieve the most recent weekly digest for the authenticated teacher.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Digest retrieved
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
 *                   nullable: true
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
router.get('/weekly-digest', authenticateToken, getLatestDigest);
/**
 * @openapi
 * /api/reports/weekly-digest/{weekStart}:
 *   get:
 *     tags: [Reports]
 *     summary: Get digest by week
 *     description: Retrieve a specific weekly digest by its start date.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: weekStart
 *         required: true
 *         schema:
 *           type: string
 *         description: Week start date (e.g. '2024-01-01')
 *     responses:
 *       200:
 *         description: Digest retrieved
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
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Digest not found for this week
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
router.get('/weekly-digest/:weekStart', authenticateToken, getDigestByWeek);

/**
 * @openapi
 * /api/reports/jobs/{jobId}:
 *   get:
 *     tags: [Reports]
 *     summary: Get job status
 *     description: Check the status of a background job (e.g. bulk report generation).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [pending, processing, completed, failed]
 *                     result:
 *                       type: object
 *                       nullable: true
 *                     error:
 *                       type: string
 *                       nullable: true
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/jobs/:jobId', authenticateToken, (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
  res.json({ success: true, data: job });
});

module.exports = router;
