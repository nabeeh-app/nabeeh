const express = require('express');
const { z } = require('zod');
const { supabase, supabaseAdmin } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const createRuleSchema = z.object({
  body: z.object({
    alert_type: z.enum(['attendance_threshold', 'grade_threshold', 'trend_anomaly']),
    threshold_value: z.number(),
    comparison: z.enum(['gt', 'lt', 'gte', 'lte']),
    notification_method: z.enum(['in_app', 'whatsapp', 'both']).default('in_app'),
  }),
});

const updateRuleSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    alert_type: z.enum(['attendance_threshold', 'grade_threshold', 'trend_anomaly']).optional(),
    threshold_value: z.number().optional(),
    comparison: z.enum(['gt', 'lt', 'gte', 'lte']).optional(),
    notification_method: z.enum(['in_app', 'whatsapp', 'both']).optional(),
  }),
});

const paramsSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

const getAlertsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    severity: z.string().optional(),
    alert_type: z.string().optional(),
    unread_only: z.coerce.boolean().optional(),
  }),
});

const getRules = async (req, res) => {
  const teacherId = req.user.teacherId || req.user.id;
  const { data, error } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  res.json({ success: true, data: data || [] });
};

const createRule = async (req, res) => {
  const teacherId = req.user.teacherId || req.user.id;
  const { alert_type, threshold_value, comparison, notification_method } = req.validated.body;
  const { data, error } = await supabaseAdmin
    .from('alert_rules')
    .insert([{ teacher_id: teacherId, alert_type, threshold_value, comparison, notification_method }])
    .select().single();
  if (error) throw error;
  res.status(201).json({ success: true, data });
};

const updateRule = async (req, res) => {
  const teacherId = req.user.teacherId || req.user.id;
  const { id } = req.validated.params;
  const updates = {};
  for (const key of ['alert_type', 'threshold_value', 'comparison', 'notification_method']) {
    if (req.validated.body[key] !== undefined) updates[key] = req.validated.body[key];
  }
  const { data, error } = await supabaseAdmin
    .from('alert_rules')
    .update(updates)
    .eq('id', id).eq('teacher_id', teacherId)
    .select().single();
  if (error) throw error;
  if (!data) return res.status(404).json({ success: false, message: 'Alert rule not found', messageAr: 'لم يتم العثور على قاعدة التنبيه', code: 'NOT_FOUND' });
  res.json({ success: true, data });
};

const deleteRule = async (req, res) => {
  const teacherId = req.user.teacherId || req.user.id;
  const { id } = req.validated.params;
  const { error } = await supabaseAdmin
    .from('alert_rules')
    .delete()
    .eq('id', id).eq('teacher_id', teacherId);
  if (error) throw error;
  res.json({ success: true, message: 'Alert rule deleted' });
};

const toggleRule = async (req, res) => {
  const teacherId = req.user.teacherId || req.user.id;
  const { id } = req.validated.params;
  const { data: rule } = await supabase
    .from('alert_rules').select('is_enabled')
    .eq('id', id).eq('teacher_id', teacherId).single();
  if (!rule) return res.status(404).json({ success: false, message: 'Alert rule not found', messageAr: 'لم يتم العثور على قاعدة التنبيه', code: 'NOT_FOUND' });
  const { data, error } = await supabaseAdmin
    .from('alert_rules')
    .update({ is_enabled: !rule.is_enabled })
    .eq('id', id).select().single();
  if (error) throw error;
  res.json({ success: true, data, message: `Alert rule ${data.is_enabled ? 'enabled' : 'disabled'}` });
};

const getAlerts = async (req, res) => {
  const teacherId = req.user.teacherId || req.user.id;
  const { page, limit, severity, alert_type, unread_only } = req.validated.query;
  const offset = (page - 1) * limit;
  let query = supabase
    .from('alerts')
    .select('*, students(name, student_id)', { count: 'exact' })
    .eq('teacher_id', teacherId);
  if (severity) query = query.eq('severity', severity);
  if (alert_type) query = query.eq('alert_type', alert_type);
  if (unread_only) query = query.eq('is_read', false);
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  const { data, error, count } = await query;
  if (error) throw error;
  res.json({
    success: true,
    data: (data || []).map(a => ({
      ...a,
      student_name: a.students?.name || null,
      student_code: a.students?.student_id || null,
      students: undefined,
    })),
    pagination: { page, limit, total: count || 0, pages: Math.ceil((count || 0) / limit) },
  });
};

const markAlertRead = async (req, res) => {
  const teacherId = req.user.teacherId || req.user.id;
  const { id } = req.validated.params;
  const { error } = await supabaseAdmin
    .from('alerts').update({ is_read: true })
    .eq('id', id).eq('teacher_id', teacherId);
  if (error) throw error;
  res.json({ success: true, message: 'Alert marked as read' });
};

const markAllAlertsRead = async (req, res) => {
  const teacherId = req.user.teacherId || req.user.id;
  const { error } = await supabaseAdmin
    .from('alerts').update({ is_read: true })
    .eq('teacher_id', teacherId).eq('is_read', false);
  if (error) throw error;
  res.json({ success: true, message: 'All alerts marked as read' });
};

/**
 * @openapi
 * /api/alerts/rules:
 *   get:
 *     tags: [Alerts]
 *     summary: List alert rules
 *     description: Retrieve all alert rules configured by the authenticated teacher.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alert rules retrieved
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
router.get('/rules', authenticateToken, asyncHandler(getRules));
/**
 * @openapi
 * /api/alerts/rules:
 *   post:
 *     tags: [Alerts]
 *     summary: Create alert rule
 *     description: Create a new alert rule for monitoring student attendance, grades, or trend anomalies.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [alert_type, threshold_value, comparison]
 *             properties:
 *               alert_type:
 *                 type: string
 *                 enum: [attendance_threshold, grade_threshold, trend_anomaly]
 *                 description: Type of alert to monitor
 *               threshold_value:
 *                 type: number
 *                 description: Threshold value for the alert condition
 *               comparison:
 *                 type: string
 *                 enum: [gt, lt, gte, lte]
 *                 description: Comparison operator (greater than, less than, etc.)
 *               notification_method:
 *                 type: string
 *                 enum: [in_app, whatsapp, both]
 *                 default: in_app
 *                 description: How to deliver the alert notification
 *     responses:
 *       201:
 *         description: Alert rule created
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
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.post('/rules', authenticateToken, validate(createRuleSchema), asyncHandler(createRule));
/**
 * @openapi
 * /api/alerts/rules/{id}:
 *   put:
 *     tags: [Alerts]
 *     summary: Update alert rule
 *     description: Update an existing alert rule's properties (type, threshold, comparison, notification method).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Alert rule ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               alert_type:
 *                 type: string
 *                 enum: [attendance_threshold, grade_threshold, trend_anomaly]
 *               threshold_value:
 *                 type: number
 *               comparison:
 *                 type: string
 *                 enum: [gt, lt, gte, lte]
 *               notification_method:
 *                 type: string
 *                 enum: [in_app, whatsapp, both]
 *     responses:
 *       200:
 *         description: Alert rule updated
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
 *         description: Alert rule not found
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
router.put('/rules/:id', authenticateToken, validate(updateRuleSchema), asyncHandler(updateRule));
/**
 * @openapi
 * /api/alerts/rules/{id}:
 *   delete:
 *     tags: [Alerts]
 *     summary: Delete alert rule
 *     description: Permanently delete an alert rule.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Alert rule ID
 *     responses:
 *       200:
 *         description: Alert rule deleted
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
router.delete('/rules/:id', authenticateToken, validate(paramsSchema), asyncHandler(deleteRule));
/**
 * @openapi
 * /api/alerts/rules/{id}/toggle:
 *   put:
 *     tags: [Alerts]
 *     summary: Toggle alert rule
 *     description: Toggle an alert rule's enabled/disabled state.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Alert rule ID
 *     responses:
 *       200:
 *         description: Alert rule toggled
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
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Alert rule not found
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
router.put('/rules/:id/toggle', authenticateToken, validate(paramsSchema), asyncHandler(toggleRule));
/**
 * @openapi
 * /api/alerts:
 *   get:
 *     tags: [Alerts]
 *     summary: List alerts
 *     description: Retrieve paginated alerts for the authenticated teacher, with optional filters for severity, type, and read status.
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
 *           maximum: 100
 *         description: Items per page
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *         description: Filter by severity level
 *       - in: query
 *         name: alert_type
 *         schema:
 *           type: string
 *         description: Filter by alert type
 *       - in: query
 *         name: unread_only
 *         schema:
 *           type: boolean
 *         description: If true, only return unread alerts
 *     responses:
 *       200:
 *         description: Alerts retrieved
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
router.get('/', authenticateToken, validate(getAlertsSchema), asyncHandler(getAlerts));
/**
 * @openapi
 * /api/alerts/{id}/read:
 *   put:
 *     tags: [Alerts]
 *     summary: Mark alert read
 *     description: Mark a single alert as read.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Alert ID
 *     responses:
 *       200:
 *         description: Alert marked as read
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
router.put('/:id/read', authenticateToken, validate(paramsSchema), asyncHandler(markAlertRead));
/**
 * @openapi
 * /api/alerts/read-all:
 *   put:
 *     tags: [Alerts]
 *     summary: Mark all alerts read
 *     description: Mark all unread alerts for the authenticated teacher as read.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All alerts marked as read
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
router.put('/read-all', authenticateToken, asyncHandler(markAllAlertsRead));

module.exports = router;
