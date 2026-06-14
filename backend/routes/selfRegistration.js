const express = require('express');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/database').supabaseAdmin;
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { logAudit } = require('../lib/auditLog');
const logger = require('../lib/logger');

const router = express.Router();

/**
 * @openapi
 * /api/self-registration/link:
 *   post:
 *     tags: [Self Registration]
 *     summary: Generate registration link
 *     description: Generate a unique self-registration link for a group. The link allows students to enroll themselves.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [groupId]
 *             properties:
 *               groupId:
 *                 type: string
 *                 format: uuid
 *                 description: The group to generate a registration link for
 *               expiresInHours:
 *                 type: integer
 *                 default: 168
 *                 description: Link expiration time in hours (default 7 days)
 *     responses:
 *       200:
 *         description: Registration link generated
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
 *                     url:
 *                       type: string
 *                     token:
 *                       type: string
 *                     expiresAt:
 *                       type: string
 *                     groupName:
 *                       type: string
 *                     subject:
 *                       type: string
 *       400:
 *         description: Missing groupId
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
 *       403:
 *         description: Unauthorized for this group
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Group not found
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
router.post('/link', authenticateToken, requirePermission('manage_students'), async (req, res) => {
  try {
    const { groupId, expiresInHours = 168 } = req.body;

    if (!groupId) {
      return res.status(400).json({ success: false, message: 'Group ID is required' });
    }

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, name, offering:offerings(teacher_id, subject:subjects(name_en, name_ar))')
      .eq('id', groupId)
      .single();

    if (groupError || !group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }

    if (group.offering.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized for this group' });
    }

    const token = uuidv4();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

    const { error: tokenError } = await supabase
      .from('self_registration_tokens')
      .insert([{
        token,
        group_id: groupId,
        teacher_id: req.user.id,
        expires_at: expiresAt,
        max_uses: 100,
        use_count: 0
      }]);

    if (tokenError) {
      if (tokenError.code === '42P01') {
        logger.warn('self_registration_tokens table does not exist — creating it', { teacherId: req.user.id });
        await supabase.rpc('exec_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS self_registration_tokens (
              id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
              token UUID NOT NULL UNIQUE,
              group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
              teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
              expires_at TIMESTAMPTZ NOT NULL,
              max_uses INT DEFAULT 100,
              use_count INT DEFAULT 0,
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
            ALTER TABLE self_registration_tokens ENABLE ROW LEVEL SECURITY;
          `
        });

        const { error: retryError } = await supabase
          .from('self_registration_tokens')
          .insert([{
            token,
            group_id: groupId,
            teacher_id: req.user.id,
            expires_at: expiresAt,
            max_uses: 100,
            use_count: 0
          }]);

        if (retryError) throw retryError;
      } else {
        throw tokenError;
      }
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const registrationUrl = `${frontendUrl}/register/student?token=${token}`;

    await logAudit({
      actorId: req.user.id,
      actorType: req.user.role === 'teacher' ? 'teacher' : 'assistant',
      teacherId: req.user.teacherId || req.user.id,
      action: 'registration_link_created',
      entityType: 'self_registration',
      metadata: { groupId, groupName: group.name, expiresAt },
      ipAddress: req.ip
    });

    res.json({
      success: true,
      data: {
        url: registrationUrl,
        token,
        expiresAt,
        groupName: group.name,
        subject: group.offering.subject?.name_en || group.offering.subject?.name_ar || ''
      }
    });
  } catch (error) {
    logger.error('Generate registration link error', { error: error.message, teacherId: req.user.id });
    res.status(500).json({ success: false, message: 'Failed to generate registration link' });
  }
});

/**
 * @openapi
 * /api/self-registration/form/{token}:
 *   get:
 *     tags: [Self Registration]
 *     summary: Get registration form
 *     description: Retrieve registration form details (group name, teacher name) by token. This is a public endpoint with no authentication required.
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Registration token
 *     responses:
 *       200:
 *         description: Form details retrieved
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
 *                     groupName:
 *                       type: string
 *                     teacherName:
 *                       type: string
 *                     fields:
 *                       type: array
 *                       items:
 *                         type: string
 *       404:
 *         description: Invalid registration link
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       410:
 *         description: Link expired or max uses reached
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
router.get('/form/:token', async (req, res) => {
  try {
    const { token } = req.params;

    const { data: tokenRecord, error: tokenError } = await supabase
      .from('self_registration_tokens')
      .select('*, group:groups(name, offering:offerings(teacher:teachers(name)))')
      .eq('token', token)
      .single();

    if (tokenError || !tokenRecord) {
      return res.status(404).json({ success: false, message: 'Invalid or expired registration link' });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: 'This registration link has expired' });
    }

    if (tokenRecord.use_count >= tokenRecord.max_uses) {
      return res.status(410).json({ success: false, message: 'This registration link has reached its maximum uses' });
    }

    res.json({
      success: true,
      data: {
        groupName: tokenRecord.group?.name,
        teacherName: tokenRecord.group?.offering?.teacher?.name,
        fields: ['name', 'phone']
      }
    });
  } catch (error) {
    logger.error('Get registration form error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to load registration form' });
  }
});

/**
 * @openapi
 * /api/self-registration/submit/{token}:
 *   post:
 *     tags: [Self Registration]
 *     summary: Submit registration
 *     description: Submit a self-registration form. Creates a new student record and enrolls them in the group. This is a public endpoint with no authentication required.
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Registration token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 description: Student's full name
 *               phone:
 *                 type: string
 *                 description: Student's phone number
 *               parent_phone:
 *                 type: string
 *                 description: Parent's phone number (creates a parent record)
 *     responses:
 *       201:
 *         description: Registration successful
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
 *                     studentId:
 *                       type: string
 *                     studentCode:
 *                       type: string
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing name
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Invalid registration link
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       410:
 *         description: Link expired or max uses reached
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
router.post('/submit/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { name, phone, parent_phone } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    const { data: tokenRecord, error: tokenError } = await supabase
      .from('self_registration_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !tokenRecord) {
      return res.status(404).json({ success: false, message: 'Invalid or expired registration link' });
    }

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: 'This registration link has expired' });
    }

    if (tokenRecord.use_count >= tokenRecord.max_uses) {
      return res.status(410).json({ success: false, message: 'This registration link has reached its maximum uses' });
    }

    const studentCode = `REG-${Date.now().toString(36).toUpperCase()}`;

    const { data: student, error: studentError } = await supabase
      .from('students')
      .insert([{
        name: name.trim(),
        phone: phone || null,
        student_code: studentCode,
        teacher_id: tokenRecord.teacher_id,
        is_demo: false
      }])
      .select()
      .single();

    if (studentError) throw studentError;

    const { error: enrollError } = await supabase
      .from('enrollments')
      .insert({
        student_id: student.id,
        group_id: tokenRecord.group_id,
        teacher_id: tokenRecord.teacher_id,
        status: 'active'
      });

    if (enrollError) throw enrollError;

    if (parent_phone) {
      await supabase.from('parents').insert([{
        student_id: student.id,
        name: `Parent of ${name.trim()}`,
        phone: parent_phone,
        relationship: 'guardian',
        is_primary: true,
        preferred_language: 'ar'
      }]);
    }

    await supabase
      .from('self_registration_tokens')
      .update({ use_count: tokenRecord.use_count + 1 })
      .eq('id', tokenRecord.id);

    await logAudit({
      actorId: tokenRecord.teacher_id,
      actorType: 'system',
      teacherId: tokenRecord.teacher_id,
      action: 'student_self_registered',
      entityType: 'student',
      entityId: student.id,
      metadata: { name: name.trim(), token, groupName: tokenRecord.group_id },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: { studentId: student.id, studentCode },
      message: 'Registration successful! Your teacher will confirm your enrollment.'
    });
  } catch (error) {
    logger.error('Self-registration submit error', { error: error.message });
    res.status(500).json({ success: false, message: 'Registration failed. Please try again.' });
  }
});

module.exports = router;
