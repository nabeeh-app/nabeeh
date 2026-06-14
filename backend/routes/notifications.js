const express = require('express');
const { z } = require('zod');
const { supabaseAdmin } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../lib/logger');

const router = express.Router();

// ── Zod Schemas ────────────────────────────────────────────────
const getNotificationsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    type: z.string().optional(),
    unread_only: z.coerce.boolean().optional(),
  }),
});

const markReadParamsSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
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

// ── GET / — List notifications (paginated, unread first) ───────
const getNotifications = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { page, limit, type, unread_only } = req.validated.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('teacher_id', teacherId);

    if (type) query = query.eq('type', type);
    if (unread_only) query = query.eq('is_read', false);

    query = query
      .order('is_read', { ascending: true })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    logger.error('Get notifications error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching notifications' });
  }
};

// ── GET /unread-count ──────────────────────────────────────────
const getUnreadCount = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { count } = await supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', teacherId)
      .eq('is_read', false);

    res.json({ success: true, data: { count: count || 0 } });
  } catch (error) {
    logger.error('Get unread count error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching unread count' });
  }
};

// ── PUT /:id/read — Mark single notification as read ───────────
const markRead = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { id } = req.validated.params;

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('teacher_id', teacherId);

    if (error) throw error;

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    logger.error('Mark notification read error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error marking notification' });
  }
};

// ── PUT /read-all — Mark all as read ───────────────────────────
const markAllRead = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;

    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ is_read: true })
      .eq('teacher_id', teacherId)
      .eq('is_read', false);

    if (error) throw error;

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    logger.error('Mark all notifications read error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error marking notifications' });
  }
};

// ── DELETE /:id — Delete a notification ────────────────────────
const deleteNotification = async (req, res) => {
  try {
    const teacherId = req.user.teacherId || req.user.id;
    const { id } = req.validated.params;

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('teacher_id', teacherId);

    if (error) throw error;

    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    logger.error('Delete notification error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error deleting notification' });
  }
};

// ── Route Definitions ──────────────────────────────────────────
/**
 * @openapi
 * /api/notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Get unread count
 *     description: Get the count of unread notifications for the authenticated teacher.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved
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
 *                     count:
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
router.get('/unread-count', authenticateToken, getUnreadCount);
/**
 * @openapi
 * /api/notifications/read-all:
 *   put:
 *     tags: [Notifications]
 *     summary: Mark all read
 *     description: Mark all unread notifications for the authenticated teacher as read.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
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
router.put('/read-all', authenticateToken, markAllRead);
/**
 * @openapi
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List notifications
 *     description: Retrieve paginated notifications for the authenticated teacher, ordered by unread first then by date. Supports filtering by type and read status.
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
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by notification type
 *       - in: query
 *         name: unread_only
 *         schema:
 *           type: boolean
 *         description: If true, only return unread notifications
 *     responses:
 *       200:
 *         description: Notifications retrieved
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
router.get('/', authenticateToken, validate(getNotificationsSchema), getNotifications);
/**
 * @openapi
 * /api/notifications/{id}/read:
 *   put:
 *     tags: [Notifications]
 *     summary: Mark notification read
 *     description: Mark a single notification as read.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
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
router.put('/:id/read', authenticateToken, validate(markReadParamsSchema), markRead);
/**
 * @openapi
 * /api/notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete notification
 *     description: Permanently delete a notification.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification deleted
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
router.delete('/:id', authenticateToken, validate(markReadParamsSchema), deleteNotification);

module.exports = router;
