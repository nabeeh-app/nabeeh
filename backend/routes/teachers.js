const express = require('express');
const { supabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { z } = require('zod');
const { validate, updateProfileSchema, updateSettingsSchema } = require('../middleware/validate');
const logger = require('../lib/logger');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// @desc    Get teacher profile
// @route   GET /api/teachers/profile
// @access  Private
const getProfile = async (req, res) => {
  const { data: teacher, error } = await supabase
    .from('teachers')
    .select('id, email, name, phone, business_name, bio, subjects, address, city, country, timezone, whatsapp_number, telegram_username, preferred_language, role, is_active, created_at, updated_at')
    .eq('id', req.user.id)
    .single();

  if (error) throw error;

  const { data: studentCount } = await supabase
    .rpc('teacher_student_count', { p_teacher_id: req.user.id });

  const teacherProfile = {
    ...teacher,
    students: { count: studentCount || 0 }
  };

  res.status(200).json({
    success: true,
    data: teacherProfile
  });
};

// @desc    Get teacher dashboard stats
// @route   GET /api/teachers/dashboard
// @access  Private
const getDashboardStats = async (req, res) => {
  const teacherId = req.user.id;

  const { data: statsJson, error: rpcError } = await supabase
    .rpc('dashboard_stats', { p_teacher_id: teacherId });

  if (rpcError) throw rpcError;

  const stats = typeof statsJson === 'string' ? JSON.parse(statsJson) : statsJson;

  const { data: recentGrades } = await supabase
    .from('grades')
    .select(`
      score,
      assessment:assessments!inner(
          name,
          date,
          offering:offerings!inner(teacher_id)
      ),
      enrollment:enrollments!inner(
          student:students(name, student_id)
      )
    `)
    .eq('assessments.offerings.teacher_id', teacherId)
    .order('assessments.date', { ascending: false })
    .limit(5);

  const { data: recentMessages } = await supabase
    .from('messages')
    .select(`
      *,
      conversations!inner (
        teacher_id,
        parents (name)
      )
    `)
    .eq('conversations.teacher_id', teacherId)
    .order('created_at', { ascending: false })
    .limit(5);

  const formattedGrades = recentGrades?.map(g => ({
    score: g.score,
    assessment_name: g.assessment.name,
    student_name: g.enrollment.student.name,
    date: g.assessment.date
  })) || [];

  res.status(200).json({
    success: true,
    data: {
      stats: {
        total_students: stats.student_count || 0,
        total_parents: stats.parent_count || 0,
        today_attendance: stats.today_attendance || 0,
        weekly_messages: stats.weekly_messages || 0
      },
      recent_grades: formattedGrades,
      recent_messages: recentMessages || []
    }
  });
};

// @desc    Get teacher settings
// @route   GET /api/teachers/settings
// @access  Private
const getSettings = async (req, res) => {
  const { data: settings, error } = await supabase
    .from('teacher_settings')
    .select('notifications, theme, language')
    .eq('teacher_id', req.user.id)
    .single();

  if (error || !settings) {
    return res.status(200).json({
      success: true,
      data: { notifications: { attendance: true, grades: true, messages: true }, theme: 'system', language: 'en' }
    });
  }

  res.status(200).json({
    success: true,
    data: settings
  });
};

// @desc    Update teacher settings
// @route   PUT /api/teachers/settings
// @access  Private
const updateSettings = async (req, res) => {
  const { notifications, theme, language } = req.body;
  const teacherId = req.user.id;

  const updates = {};
  if (notifications !== undefined) updates.notifications = notifications;
  if (theme !== undefined) updates.theme = theme;
  if (language !== undefined) updates.language = language;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'No settings provided', messageAr: 'لم يتم تقديم إعدادات', code: 'VALIDATION_ERROR' });
  }

  const { data: updatedSettings, error } = await supabase
    .from('teacher_settings')
    .upsert({
      teacher_id: teacherId,
      ...updates
    }, { onConflict: 'teacher_id' })
    .select('notifications, theme, language')
    .single();

  if (error) {
    return res.status(400).json({ success: false, message: error.message, messageAr: 'فشل في تحديث الإعدادات', code: 'INTERNAL_ERROR' });
  }

  res.status(200).json({
    success: true,
    data: updatedSettings,
    message: 'Settings updated successfully'
  });
};

const notificationPreferencesSchema = z.object({
  body: z.object({
    attendance_marked: z.boolean().optional(),
    grade_entered: z.boolean().optional(),
    whatsapp_sent: z.boolean().optional(),
    assistant_action: z.boolean().optional(),
    digest: z.boolean().optional(),
    alert: z.boolean().optional(),
    report_ready: z.boolean().optional(),
    quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
    quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  }).refine(data => Object.keys(data).length > 0, { message: 'At least one preference must be provided' }),
});

// @desc    Update notification preferences
// @route   PUT /api/teachers/notification-preferences
// @access  Private
const updateNotificationPreferences = async (req, res) => {
  const teacherId = req.user.id;
  const prefs = req.body;

  const { data: existing } = await supabase
    .from('teacher_settings')
    .select('notification_preferences')
    .eq('teacher_id', teacherId)
    .single();

  const currentPrefs = existing?.notification_preferences || {};
  const updatedPrefs = { ...currentPrefs, ...prefs };

  const { data, error } = await supabase
    .from('teacher_settings')
    .upsert({
      teacher_id: teacherId,
      notification_preferences: updatedPrefs,
    }, { onConflict: 'teacher_id' })
    .select('notification_preferences')
    .single();

  if (error) throw error;

  res.status(200).json({
    success: true,
    data: data.notification_preferences,
    message: 'Notification preferences updated successfully',
  });
};

/**
 * @openapi
 * /api/teachers/profile:
 *   get:
 *     tags: [Teachers]
 *     summary: Get teacher profile
 *     description: Retrieve the authenticated teacher's full profile, including student count.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/TeacherProfile'
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
router.get('/profile', authenticateToken, asyncHandler(getProfile));

/**
 * @openapi
 * /api/teachers/dashboard:
 *   get:
 *     tags: [Teachers]
 *     summary: Get dashboard stats
 *     description: Retrieve aggregated dashboard statistics including student count, parent count, today's attendance, weekly messages, recent grades, and recent messages.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats retrieved successfully
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
 *                     stats:
 *                       type: object
 *                       properties:
 *                         total_students:
 *                           type: integer
 *                         total_parents:
 *                           type: integer
 *                         today_attendance:
 *                           type: integer
 *                         weekly_messages:
 *                           type: integer
 *                     recent_grades:
 *                       type: array
 *                       items:
 *                         type: object
 *                     recent_messages:
 *                       type: array
 *                       items:
 *                         type: object
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
router.get('/dashboard', authenticateToken, asyncHandler(getDashboardStats));

/**
 * @openapi
 * /api/teachers/settings:
 *   get:
 *     tags: [Teachers]
 *     summary: Get teacher settings
 *     description: Retrieve the authenticated teacher's settings (notifications, theme, language). Returns defaults if none exist.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings retrieved successfully
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
 *                     notifications:
 *                       type: object
 *                     theme:
 *                       type: string
 *                     language:
 *                       type: string
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
router.get('/settings', authenticateToken, asyncHandler(getSettings));

/**
 * @openapi
 * /api/teachers/settings:
 *   put:
 *     tags: [Teachers]
 *     summary: Update teacher settings
 *     description: Update or create the authenticated teacher's settings. Only provided fields are updated. Uses upsert on teacher_settings.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notifications:
 *                 type: object
 *                 description: Notification settings object
 *               theme:
 *                 type: string
 *                 enum: [light, dark, system]
 *                 description: UI theme preference
 *               language:
 *                 type: string
 *                 enum: [ar, en]
 *                 description: Preferred language
 *     responses:
 *       200:
 *         description: Settings updated successfully
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
 *                     notifications:
 *                       type: object
 *                     theme:
 *                       type: string
 *                     language:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: No settings provided or validation error
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
router.put('/settings', authenticateToken, validate(updateSettingsSchema), asyncHandler(updateSettings));

/**
 * @openapi
 * /api/teachers/notification-preferences:
 *   put:
 *     tags: [Teachers]
 *     summary: Update notification preferences
 *     description: Update the authenticated teacher's notification preferences. Merges with existing preferences. At least one field must be provided.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               attendance_marked:
 *                 type: boolean
 *                 description: Receive notification when attendance is marked
 *               grade_entered:
 *                 type: boolean
 *                 description: Receive notification when a grade is entered
 *               whatsapp_sent:
 *                 type: boolean
 *                 description: Receive notification when a WhatsApp message is sent
 *               assistant_action:
 *                 type: boolean
 *                 description: Receive notification on assistant actions
 *               digest:
 *                 type: boolean
 *                 description: Receive daily/weekly digest
 *               alert:
 *                 type: boolean
 *                 description: Receive alert notifications
 *               report_ready:
 *                 type: boolean
 *                 description: Receive notification when a report is ready
 *               quiet_hours_start:
 *                 type: string
 *                 pattern: '^\d{2}:\d{2}$'
 *                 description: Quiet hours start time (HH:MM)
 *               quiet_hours_end:
 *                 type: string
 *                 pattern: '^\d{2}:\d{2}$'
 *                 description: Quiet hours end time (HH:MM)
 *     responses:
 *       200:
 *         description: Notification preferences updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   description: Updated notification preferences
 *                 message:
 *                   type: string
 *       400:
 *         description: No preferences provided or validation error
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
router.put('/notification-preferences', authenticateToken, validate(notificationPreferencesSchema), asyncHandler(updateNotificationPreferences));

module.exports = router;
