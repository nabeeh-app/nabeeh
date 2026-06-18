const express = require('express');
const { z } = require('zod');
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { logAudit } = require('../lib/auditLog');
const { getAssistantInviteTemplate } = require('../lib/emailTemplates');
const { sendEmail } = require('../lib/email');
const logger = require('../lib/logger');
const sessionManager = require('../lib/sessionManager');

const router = express.Router();

// Subscription tier limits for pending invites
const INVITE_LIMITS = { free: 5, basic: 5, pro: 5, center: 15 };

// Default permissions for new assistants
const DEFAULT_PERMISSIONS = {
  view_students: true,
  manage_attendance: true,
  manage_grades: false,
  manage_assessments: false,
  manage_offerings: false,
  send_whatsapp: false,
  view_reports: true,
  manage_students: false
};

const VALID_PERMISSIONS = Object.keys(DEFAULT_PERMISSIONS);

// --- Zod Schemas ---

const inviteSchema = z.object({
  body: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    deliveryMethod: z.enum(['email', 'whatsapp', 'both']).default('email'),
    permissions: z.record(z.string(), z.boolean()).optional()
  }).refine(data => data.email || data.phone, {
    message: 'At least one of email or phone is required'
  })
});

const acceptSchema = z.object({
  body: z.object({
    token: z.string().min(1)
  })
});

const updatePermissionsSchema = z.object({
  body: z.object({
    permissions: z.record(z.string(), z.boolean())
  }),
  params: z.object({ id: z.string().uuid() })
});

const updateStatusSchema = z.object({
  body: z.object({
    status: z.enum(['active', 'inactive'])
  }),
  params: z.object({ id: z.string().uuid() })
});

const removeParamsSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

// --- Helpers ---

async function getTeacherTier(teacherId) {
  const { data } = await supabaseAdmin
    .from('teachers')
    .select('subscription_tier')
    .eq('id', teacherId)
    .single();
  return data?.subscription_tier || 'free';
}

async function countPendingInvites(teacherId) {
  const { count } = await supabaseAdmin
    .from('assistant_invites')
    .select('id', { count: 'exact', head: true })
    .eq('teacher_id', teacherId)
    .eq('status', 'pending');
  return count || 0;
}

// --- Route Handlers ---

// POST /api/assistants/invite — Send invite to assistant by email/WhatsApp
const inviteAssistant = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { email, phone, deliveryMethod = 'email', permissions } = req.body;

    // Check tier limit
    const tier = await getTeacherTier(teacherId);
    const limit = INVITE_LIMITS[tier] || 0;
    if (limit === 0) {
      return res.status(403).json({
        success: false,
        message: `Your ${tier} plan does not support assistants. Please upgrade.`,
        code: 'TIER_LIMIT'
      });
    }

    const pendingCount = await countPendingInvites(teacherId);
    if (pendingCount >= limit) {
      return res.status(403).json({
        success: false,
        message: `You have reached the maximum of ${limit} pending invites for your ${tier} plan.`,
        code: 'INVITE_LIMIT'
      });
    }

    // Check duplicate by email
    if (email) {
      const { data: existingInvite } = await supabaseAdmin
        .from('assistant_invites')
        .select('id')
        .eq('teacher_id', teacherId)
        .eq('email', email.toLowerCase())
        .eq('status', 'pending')
        .maybeSingle();

      if (existingInvite) {
        return res.status(409).json({ success: false, message: 'A pending invite already exists for this email.', code: 'INVITE_EXISTS' });
      }

      const { data: existingUser } = await supabaseAdmin
        .from('teachers')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (existingUser) {
        const { data: existingLink } = await supabaseAdmin
          .from('teacher_assistants')
          .select('id')
          .eq('teacher_id', teacherId)
          .eq('assistant_id', existingUser.id)
          .eq('status', 'active')
          .maybeSingle();

        if (existingLink) {
          return res.status(409).json({ success: false, message: 'This user is already your assistant.', code: 'ALREADY_ASSISTANT' });
        }
      }
    }

    // Create invite
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('assistant_invites')
      .insert([{
        teacher_id: teacherId,
        email: email?.toLowerCase() || null,
        phone: phone || null,
        token,
        permissions: permissions || DEFAULT_PERMISSIONS,
        status: 'pending',
        expires_at: expiresAt
      }])
      .select()
      .single();

    if (inviteError) throw inviteError;

    // Get teacher name for messages
    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('name')
      .eq('id', teacherId)
      .single();

    const teacherName = teacher?.name || 'Your teacher';
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invite/${token}`;

    // Send email
    if ((deliveryMethod === 'email' || deliveryMethod === 'both') && email) {
      try {
        const template = getAssistantInviteTemplate({ teacherName, inviteLink, language: 'en' });
        const result = await sendEmail({
          to: email,
          from: 'Nabeeh <noreply@nabeeh.app>',
          subject: template.subject,
          html: template.html,
          idempotencyKey: `invite-${invite.id}-email`,
        });
        if (!result.success) {
          logger.error('Failed to send invite email', { email, error: result.error });
        }
      } catch (emailError) {
        logger.error('Failed to send invite email', { error: emailError.message });
      }
    }

    // Send WhatsApp
    if ((deliveryMethod === 'whatsapp' || deliveryMethod === 'both') && phone) {
      try {
        const client = sessionManager.getSession(teacherId);
        if (client) {
          const waMessage = `🎓 *Nabeeh*\n\n${teacherName} has invited you to join their team as a teaching assistant.\n\nAccept here: ${inviteLink}\n\nThis link expires in 48 hours.`;
          await client.sendMessage(phone, waMessage);
        } else {
          logger.warn('No WhatsApp session for teacher, skipping invite', { teacherId });
        }
      } catch (waError) {
        logger.error('Failed to send WhatsApp invite', { phone, error: waError.message });
      }
    }

    await logAudit({
      actorId: teacherId,
      actorType: 'teacher',
      teacherId,
      action: 'assistant_invited',
      entityType: 'assistant',
      entityId: invite.id,
      metadata: { email: email?.toLowerCase(), phone, deliveryMethod },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: { id: invite.id, email: invite.email, phone: invite.phone, expires_at: invite.expires_at },
      message: 'Invitation sent successfully'
    });
  } catch (error) {
    logger.error('Invite assistant error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error sending invitation' });
  }
};

// GET /api/assistants/invites — List pending invites
const listInvites = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const { data: invites, error } = await supabaseAdmin
      .from('assistant_invites')
      .select('id, email, permissions, status, created_at, expires_at')
      .eq('teacher_id', teacherId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ success: true, data: invites });
  } catch (error) {
    logger.error('List invites error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching invites' });
  }
};

// POST /api/assistants/accept — Accept invite (by token)
const acceptInvite = async (req, res) => {
  try {
    const { token } = req.body;
    const assistantId = req.user.id;

    // Find valid invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('assistant_invites')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .maybeSingle();

    if (inviteError || !invite) {
      return res.status(404).json({ success: false, message: 'Invalid or expired invitation.', code: 'INVALID_INVITE' });
    }

    // Check expiry
    if (new Date(invite.expires_at) < new Date()) {
      await supabaseAdmin
        .from('assistant_invites')
        .update({ status: 'expired' })
        .eq('id', invite.id);

      return res.status(410).json({ success: false, message: 'Invitation has expired.', code: 'INVITE_EXPIRED' });
    }

    // Check if already an active assistant for this teacher
    const { data: existingLink } = await supabaseAdmin
      .from('teacher_assistants')
      .select('id')
      .eq('teacher_id', invite.teacher_id)
      .eq('assistant_id', assistantId)
      .eq('status', 'active')
      .maybeSingle();

    if (existingLink) {
      return res.status(409).json({ success: false, message: 'You are already an assistant for this teacher.', code: 'ALREADY_ASSISTANT' });
    }

    // Create the assistant link
    const { data: link, error: linkError } = await supabaseAdmin
      .from('teacher_assistants')
      .insert([{
        teacher_id: invite.teacher_id,
        assistant_id: assistantId,
        permissions: invite.permissions,
        status: 'active'
      }])
      .select()
      .single();

    if (linkError) throw linkError;

    // Mark invite as accepted
    await supabaseAdmin
      .from('assistant_invites')
      .update({ status: 'accepted' })
      .eq('id', invite.id);

    await logAudit({
      actorId: assistantId,
      actorType: 'assistant',
      teacherId: invite.teacher_id,
      action: 'assistant_activated',
      entityType: 'assistant',
      entityId: link.id,
      metadata: { email: invite.email },
      ipAddress: req.ip
    });

    res.status(201).json({
      success: true,
      data: { id: link.id, teacher_id: link.teacher_id, permissions: link.permissions },
      message: 'You are now an assistant. Welcome!'
    });
  } catch (error) {
    logger.error('Accept invite error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error accepting invitation' });
  }
};

// GET /api/assistants — List all assistants for this teacher
const listAssistants = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const { data: assistants, error } = await supabaseAdmin
      .from('teacher_assistants')
      .select('id, status, permissions, assistant_id, created_at, updated_at')
      .eq('teacher_id', teacherId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const assistantIds = assistants.map(a => a.assistant_id);
    let teacherMap = {};
    if (assistantIds.length > 0) {
      const { data: teachers } = await supabaseAdmin
        .from('teachers')
        .select('id, name, email')
        .in('id', assistantIds);
      teacherMap = Object.fromEntries((teachers || []).map(t => [t.id, t]));
    }

    const result = assistants.map(a => ({
      id: a.id,
      name: teacherMap[a.assistant_id]?.name || 'Unknown',
      email: teacherMap[a.assistant_id]?.email || 'Unknown',
      status: a.status,
      permissions: a.permissions,
      created_at: a.created_at,
      updated_at: a.updated_at
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('List assistants error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching assistants' });
  }
};

// PUT /api/assistants/:id/permissions — Update assistant permissions
const updatePermissions = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { id } = req.params;
    const { permissions } = req.body;

    // Filter to only valid permission keys
    const filteredPermissions = {};
    for (const key of VALID_PERMISSIONS) {
      if (key in permissions) {
        filteredPermissions[key] = Boolean(permissions[key]);
      }
    }

    // Verify ownership
    const { data: link, error: fetchError } = await supabaseAdmin
      .from('teacher_assistants')
      .select('id, teacher_id, assistant:teachers!assistant_id(name, email)')
      .eq('id', id)
      .eq('teacher_id', teacherId)
      .maybeSingle();

    if (fetchError || !link) {
      return res.status(404).json({ success: false, message: 'Assistant not found' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('teacher_assistants')
      .update({ permissions: filteredPermissions, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    await logAudit({
      actorId: teacherId,
      actorType: 'teacher',
      teacherId,
      action: 'assistant_permissions_updated',
      entityType: 'assistant',
      entityId: id,
      metadata: { permissions: filteredPermissions },
      ipAddress: req.ip
    });

    res.json({ success: true, data: { id, permissions: filteredPermissions }, message: 'Permissions updated' });
  } catch (error) {
    logger.error('Update permissions error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error updating permissions' });
  }
};

// PUT /api/assistants/:id/status — Activate/deactivate assistant
const updateStatus = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { id } = req.params;
    const { status } = req.body;

    const { data: link, error: fetchError } = await supabaseAdmin
      .from('teacher_assistants')
      .select('id, teacher_id')
      .eq('id', id)
      .eq('teacher_id', teacherId)
      .maybeSingle();

    if (fetchError || !link) {
      return res.status(404).json({ success: false, message: 'Assistant not found' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('teacher_assistants')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) throw updateError;

    const action = status === 'active' ? 'assistant_activated' : 'assistant_deactivated';

    await logAudit({
      actorId: teacherId,
      actorType: 'teacher',
      teacherId,
      action,
      entityType: 'assistant',
      entityId: id,
      metadata: { status },
      ipAddress: req.ip
    });

    res.json({ success: true, data: { id, status }, message: `Assistant ${status}` });
  } catch (error) {
    logger.error('Update status error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error updating status' });
  }
};

// DELETE /api/assistants/:id — Remove assistant (soft delete)
const removeAssistant = async (req, res) => {
  try {
    const teacherId = req.user.id;
    const { id } = req.params;

    const { data: link, error: fetchError } = await supabaseAdmin
      .from('teacher_assistants')
      .select('id, teacher_id')
      .eq('id', id)
      .eq('teacher_id', teacherId)
      .maybeSingle();

    if (fetchError || !link) {
      return res.status(404).json({ success: false, message: 'Assistant not found' });
    }

    // Soft delete — set status to 'removed'
    const { error: deleteError } = await supabaseAdmin
      .from('teacher_assistants')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (deleteError) throw deleteError;

    await logAudit({
      actorId: teacherId,
      actorType: 'teacher',
      teacherId,
      action: 'assistant_removed',
      entityType: 'assistant',
      entityId: id,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Assistant removed' });
  } catch (error) {
    logger.error('Remove assistant error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error removing assistant' });
  }
};

// POST /api/assistants/leave — Assistant leaves a teacher
const leaveTeacher = async (req, res) => {
  try {
    const assistantId = req.user.id;
    const { teacher_id } = req.body;

    if (!teacher_id) {
      return res.status(400).json({ success: false, message: 'teacher_id is required' });
    }

    const { data: link, error: fetchError } = await supabaseAdmin
      .from('teacher_assistants')
      .select('id')
      .eq('teacher_id', teacher_id)
      .eq('assistant_id', assistantId)
      .eq('status', 'active')
      .maybeSingle();

    if (fetchError || !link) {
      return res.status(404).json({ success: false, message: 'Active assistant link not found' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('teacher_assistants')
      .update({ status: 'removed', updated_at: new Date().toISOString() })
      .eq('id', link.id);

    if (updateError) throw updateError;

    await logAudit({
      actorId: assistantId,
      actorType: 'assistant',
      teacherId: teacher_id,
      action: 'assistant_removed',
      entityType: 'assistant',
      entityId: link.id,
      metadata: { reason: 'self_leave' },
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'You have left this teacher\'s team' });
  } catch (error) {
    logger.error('Leave teacher error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error leaving teacher' });
  }
};

// GET /api/assistants/invites/:token — Public: get invite details by token
const getInviteByToken = async (req, res) => {
  try {
    const { token } = req.params;

    const { data: invite, error } = await supabaseAdmin
      .from('assistant_invites')
      .select('id, email, phone, permissions, status, expires_at, created_at')
      .eq('token', token)
      .single();

    if (error || !invite) {
      return res.status(404).json({ success: false, message: 'Invalid or expired invitation.' });
    }

    if (invite.status !== 'pending') {
      return res.status(410).json({ success: false, message: 'This invitation has already been used.', code: 'INVITE_USED' });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return res.status(410).json({ success: false, message: 'This invitation has expired.', code: 'INVITE_EXPIRED' });
    }

    // Get teacher name
    const { data: teacher } = await supabaseAdmin
      .from('teachers')
      .select('name')
      .eq('id', invite.teacher_id)
      .single();

    res.json({
      success: true,
      data: {
        id: invite.id,
        teacherName: teacher?.name || 'A teacher',
        permissions: invite.permissions,
        expires_at: invite.expires_at,
      }
    });
  } catch (error) {
    logger.error('Get invite by token error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// --- Route Definitions ---
/**
 * @openapi
 * /api/assistants/invite:
 *   post:
 *     tags: [Assistants]
 *     summary: Invite assistant
 *     description: Send an invitation to a new teaching assistant via email, WhatsApp, or both. Respects subscription tier limits for pending invites.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Assistant's email address (at least one of email or phone required)
 *               phone:
 *                 type: string
 *                 description: Assistant's phone number (at least one of email or phone required)
 *               deliveryMethod:
 *                 type: string
 *                 enum: [email, whatsapp, both]
 *                 default: email
 *                 description: How to deliver the invitation
 *               permissions:
 *                 type: object
 *                 additionalProperties:
 *                   type: boolean
 *                 description: Permission flags for the assistant
 *     responses:
 *       201:
 *         description: Invitation sent successfully
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
 *                     id:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     expires_at:
 *                       type: string
 *                 message:
 *                   type: string
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
 *       403:
 *         description: Tier limit exceeded or plan not supported
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       409:
 *         description: Duplicate invite or already an assistant
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
router.post('/invite', authenticateToken, validate(inviteSchema), inviteAssistant);
/**
 * @openapi
 * /api/assistants/invites:
 *   get:
 *     tags: [Assistants]
 *     summary: List pending invites
 *     description: Retrieve all pending assistant invitations for the authenticated teacher.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invites retrieved successfully
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
router.get('/invites', authenticateToken, listInvites);
/**
 * @openapi
 * /api/assistants/invites/{token}:
 *   get:
 *     tags: [Assistants]
 *     summary: Get invite details
 *     description: Retrieve invitation details by token. This is a public endpoint (no authentication required) used to display invite information before accepting.
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: Invitation token
 *     responses:
 *       200:
 *         description: Invite details retrieved
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
 *                     id:
 *                       type: string
 *                     teacherName:
 *                       type: string
 *                     permissions:
 *                       type: object
 *                     expires_at:
 *                       type: string
 *       404:
 *         description: Invalid invitation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       410:
 *         description: Invitation expired or already used
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
router.get('/invites/:token', getInviteByToken);
/**
 * @openapi
 * /api/assistants/accept:
 *   post:
 *     tags: [Assistants]
 *     summary: Accept invite
 *     description: Accept an assistant invitation by token. Creates the teacher-assistant link and marks the invite as accepted.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token:
 *                 type: string
 *                 description: The invitation token
 *     responses:
 *       201:
 *         description: Invitation accepted successfully
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
 *                     id:
 *                       type: string
 *                     teacher_id:
 *                       type: string
 *                     permissions:
 *                       type: object
 *                 message:
 *                   type: string
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
 *         description: Invalid invitation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       409:
 *         description: Already an assistant for this teacher
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       410:
 *         description: Invitation expired
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
router.post('/accept', authenticateToken, validate(acceptSchema), acceptInvite);
/**
 * @openapi
 * /api/assistants:
 *   get:
 *     tags: [Assistants]
 *     summary: List assistants
 *     description: Retrieve all assistants linked to the authenticated teacher, including their permissions and status.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Assistants retrieved successfully
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
router.get('/', authenticateToken, listAssistants);
/**
 * @openapi
 * /api/assistants/{id}/permissions:
 *   put:
 *     tags: [Assistants]
 *     summary: Update permissions
 *     description: Update the permission flags for an assistant linked to the authenticated teacher.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Teacher-assistant link ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [permissions]
 *             properties:
 *               permissions:
 *                 type: object
 *                 additionalProperties:
 *                   type: boolean
 *                 description: Updated permission flags
 *     responses:
 *       200:
 *         description: Permissions updated
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
 *                     id:
 *                       type: string
 *                     permissions:
 *                       type: object
 *                 message:
 *                   type: string
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
 *         description: Assistant not found
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
router.put('/:id/permissions', authenticateToken, validate(updatePermissionsSchema), updatePermissions);
/**
 * @openapi
 * /api/assistants/{id}/status:
 *   put:
 *     tags: [Assistants]
 *     summary: Update status
 *     description: Activate or deactivate an assistant linked to the authenticated teacher.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Teacher-assistant link ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 description: New status for the assistant
 *     responses:
 *       200:
 *         description: Status updated
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
 *                     id:
 *                       type: string
 *                     status:
 *                       type: string
 *                 message:
 *                   type: string
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
 *         description: Assistant not found
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
router.put('/:id/status', authenticateToken, validate(updateStatusSchema), updateStatus);
/**
 * @openapi
 * /api/assistants/{id}:
 *   delete:
 *     tags: [Assistants]
 *     summary: Remove assistant
 *     description: Soft-delete an assistant by setting their status to 'removed'. The assistant link is preserved for audit purposes.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Teacher-assistant link ID
 *     responses:
 *       200:
 *         description: Assistant removed
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
 *         description: Assistant not found
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
router.delete('/:id', authenticateToken, validate(removeParamsSchema), removeAssistant);
/**
 * @openapi
 * /api/assistants/leave:
 *   post:
 *     tags: [Assistants]
 *     summary: Leave teacher
 *     description: Allows an assistant to leave a teacher's team. Sets the assistant link status to 'removed'.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [teacher_id]
 *             properties:
 *               teacher_id:
 *                 type: string
 *                 format: uuid
 *                 description: The teacher ID to leave
 *     responses:
 *       200:
 *         description: Successfully left teacher's team
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
 *       400:
 *         description: Missing teacher_id
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
 *         description: Active assistant link not found
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
router.post('/leave', authenticateToken, leaveTeacher);

module.exports = router;
