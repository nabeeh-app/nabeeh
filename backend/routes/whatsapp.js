const express = require('express');
const { z } = require('zod');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const sessionManager = require('../lib/sessionManager');
const supabase = require('../config/database').supabaseAdmin;
const logger = require('../lib/logger');
const whatsappQuery = require('../lib/whatsappQuery');
const messageParser = require('../lib/messageParser');
const aiResponder = require('../lib/aiResponder');

const router = express.Router();

const sendMessageSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format'),
  message: z.string().min(1).max(4096)
});

const marketingResponseCache = new Map();
const MARKETING_COOLDOWN = 60 * 60 * 1000;

// Periodic cleanup of expired marketing cache entries (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [phone, timestamp] of marketingResponseCache) {
    if (now - timestamp > MARKETING_COOLDOWN) {
      marketingResponseCache.delete(phone);
    }
  }
}, 10 * 60 * 1000).unref();

// ============================================================
// Marketing message (configurable via env)
// ============================================================
const MARKETING_MSG_AR = process.env.WHATSAPP_MARKETING_MSG_AR || `مرحباً بك! 👋\n\nأهلاً وسهلاً بحضرتك في *نَبِيه* - المساعد التعليمي الذكي! 🤖✨\n\nللأسف رقمك غير مسجل في نظامنا حالياً، ولكن نحن نرحب بك للانضمام إلى عائلة نَبِيه! 🎓\n\n🌟 *ماذا نقدم لك؟*\n📊 متابعة درجات أطفالك لحظة بلحظة\n📅 تقارير الحضور والغياب اليومية  \n🤖 مساعد ذكي يجيب على استفساراتك 24/7\n📈 تحليل أداء الطلاب وتقارير مفصلة\n💬 تواصل مباشر مع المعلمين\n\n📞 *للاشتراك والاستفسار:*\nتواصل معنا على: ${process.env.WHATSAPP_MARKETING_PHONE || '+201098455410'}\nأو زر موقعنا: ${process.env.WHATSAPP_MARKETING_URL || 'www.nabeeh-ai.com'}\n\nنتطلع لخدمتك وخدمة أطفالك! 🌟\n\n*فريق نَبِيه التعليمي* 🎓`;

const MARKETING_MSG_EN = process.env.WHATSAPP_MARKETING_MSG_EN || `Hello! 👋\n\nWelcome to *Nabeeh* - Your AI-Powered Educational Assistant! 🤖✨\n\nYour number is not registered in our system yet, but we'd love to welcome you to the Nabeeh family! 🎓\n\n🌟 *What we offer:*\n📊 Real-time student grade tracking\n📅 Daily attendance reports\n🤖 24/7 AI assistant for your questions\n📈 Detailed performance analytics\n💬 Direct communication with teachers\n\n📞 *To subscribe or inquire:*\nContact us: ${process.env.WHATSAPP_MARKETING_PHONE || '+201098455410'}\nVisit: ${process.env.WHATSAPP_MARKETING_URL || 'www.nabeeh-ai.com'}\n\nWe look forward to serving you and your children! 🌟\n\n*Nabeeh Educational Team* 🎓`;

// ============================================================
// Message handler setup (called per-session)
// ============================================================
function setupSessionMessageHandler(teacherId, client) {
  client.on('message', async (msg) => {
    try {
      const from = msg.key.remoteJid;
      const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
      if (!from || !body) return;
      if (from.endsWith('@g.us') || from.endsWith('@broadcast') || from === 'status@broadcast') return;

      logger.info('Incoming WhatsApp message', { from, bodyLength: body.length, teacherId });
      const phone = from.split('@')[0];

      await processIncomingMessage(teacherId, phone, body, from, msg.key.id);
    } catch (error) {
      logger.error('Error handling incoming message', { teacherId, error: error.message });
    }
  });
}

// Listen for new session creation to setup message handler
sessionManager.on('sessionCreated', ({ teacherId, client }) => {
  setupSessionMessageHandler(teacherId, client);
});

async function processIncomingMessage(teacherId, phone, messageContent, remoteJid, messageId) {
  const isEgyptian = phone.startsWith('20');
  const parent = await whatsappQuery.getParentByPhone(`+${phone}`);

  if (!parent) {
    const lastResponse = marketingResponseCache.get(phone);
    if (lastResponse && Date.now() - lastResponse < MARKETING_COOLDOWN) return;
    marketingResponseCache.set(phone, Date.now());

    const marketingMsg = isEgyptian ? MARKETING_MSG_AR : MARKETING_MSG_EN;
    const client = sessionManager.getSession(teacherId);
    if (client) {
      await client.sendMessage(remoteJid, marketingMsg);
    }
    return;
  }

  // Support multiple students per parent
  const students = Array.isArray(parent.students) ? parent.students : [parent.students];

  if (students.length === 0) {
    logger.warn('Parent has no students', { parentId: parent.id });
    return;
  }

  // Use first student's teacher for conversation context
  const firstStudent = students[0];
  const teacher = firstStudent.enrollments?.[0]?.group?.offering?.teacher;
  if (!teacher) {
    logger.warn('No teacher found for parent students', { parentId: parent.id });
    return;
  }

  const conversation = await whatsappQuery.findOrCreateConversation(parent.id, teacher.id, remoteJid);
  if (!conversation) return;

  if (conversation.bot_paused_until && new Date(conversation.bot_paused_until) > new Date()) {
    logger.info('Bot paused for conversation', { conversationId: conversation.id });
    await whatsappQuery.saveMessage(conversation.id, 'incoming', messageContent, { whatsapp_message_id: messageId });
    return;
  }

  await whatsappQuery.saveMessage(conversation.id, 'incoming', messageContent, { whatsapp_message_id: messageId });

  try {
    const { logAudit } = require('../lib/auditLog');
    await logAudit({
      actorId: teacher.id,
      actorType: 'system',
      teacherId: teacher.id,
      action: 'whatsapp_received',
      entityType: 'conversation',
      entityId: conversation.id,
      metadata: { phone, message_length: messageContent.length, parent_id: parent.id },
      ipAddress: null
    });
  } catch (auditError) {
    logger.error('Failed to write audit log', { error: auditError.message });
  }

  const language = parent.preferred_language || 'ar';

  // Try each student until we get a match (e.g. "Ahmed's grades" matches a student name)
  let response = null;
  for (const student of students) {
    response = await handleBotMessage(messageContent, parent, student, teacher, language);
    if (response) break;
  }

  if (response) {
    const client = sessionManager.getSession(teacherId);
    if (client) {
      await client.sendMessage(remoteJid, response.text);
      await whatsappQuery.saveMessage(conversation.id, 'outgoing', response.text, {
        is_automated: true,
        intent: response.intent,
        confidence: response.confidence
      });
    }
  }
}

async function handleBotMessage(message, parent, student, teacher, language) {
  try {
    const { intent, params } = messageParser.detectIntent(message, language);

    switch (intent) {
      case 'attendance': {
        const attendance = await whatsappQuery.getStudentAttendance(student.id);
        const text = messageParser.formatAttendanceResponse(student.name, attendance, language);
        return { text, intent: 'attendance_query', confidence: 0.9 };
      }
      case 'grades': {
        const grades = await whatsappQuery.getStudentGrades(student.id, params.subject);
        const text = messageParser.formatGradesResponse(student.name, grades, params.subject, language);
        return { text, intent: 'grade_query', confidence: 0.9 };
      }
      case 'help': {
        const text = messageParser.getHelpMessage(parent.name, language);
        return { text, intent: 'help_query', confidence: 0.9 };
      }
      default: {
        // Check FAQs first
        const faq = await whatsappQuery.getMatchingFaq(teacher.id, language, message);
        if (faq) {
          return { text: faq.answer, intent: 'faq', confidence: 0.7 };
        }
        // Fall back to AI
        return await aiResponder.generateResponse(message, {
          parentName: parent.name,
          studentName: student.name,
          teacherName: teacher.name,
          subjects: student.subjects?.join(', '),
          language,
          businessName: teacher.business_name
        });
      }
    }
  } catch (error) {
    logger.error('Message processing error', { error: error.message });
    return {
      text: language === 'ar'
        ? 'عذراً، حدث خطأ في معالجة رسالتك'
        : 'Sorry, there was an error processing your message',
      intent: 'error',
      confidence: 0.0
    };
  }
}

// ============================================================
// REST Routes
// ============================================================
router.use(authenticateToken);

function getStatusPayload(teacherId) {
  const status = sessionManager.getTeacherStatus(teacherId);
  const messages = {
    connected: 'WhatsApp session connected',
    qr_ready: 'Scan the QR code to finish pairing',
    connecting: 'Connecting to WhatsApp...',
    disconnected: 'WhatsApp session disconnected'
  };
  const currentStatus = status?.status || 'disconnected';
  return {
    success: true,
    data: {
      status: currentStatus,
      qr: status?.qr || null,
      phone: status?.phone || null
    },
    message: messages[currentStatus] || messages.disconnected
  };
}

/**
 * @openapi
 * /api/whatsapp/status:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Get WhatsApp connection status
 *     description: Retrieve the current WhatsApp session status for the authenticated teacher.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status retrieved successfully
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
 *                     status:
 *                       type: string
 *                       enum: [connected, qr_ready, connecting, disconnected]
 *                     qr:
 *                       type: string
 *                       nullable: true
 *                     phone:
 *                       type: string
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
router.get('/status', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.json(getStatusPayload(req.user.id));
});

/**
 * @openapi
 * /api/whatsapp/pair:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Start pairing
 *     description: Initiate a new WhatsApp pairing session for the authenticated teacher.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pairing session started
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
 *                     status:
 *                       type: string
 *                     qr:
 *                       type: string
 *                       nullable: true
 *                     phone:
 *                       type: string
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
router.post('/pair', async (req, res) => {
  try {
    const teacherId = req.user.id;
    const client = await sessionManager.getOrCreateSession(teacherId, { autoConnect: false });
    await client.startPairing();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json(getStatusPayload(teacherId));
  } catch (error) {
    logger.error('Failed to start WhatsApp pairing', { teacherId: req.user.id, error: error.message });
    res.status(500).json({ success: false, message: 'Failed to start WhatsApp pairing session' });
  }
});

const pairCodeSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format')
});

const sessionParamsSchema = z.object({
  teacherId: z.string().uuid('Invalid teacher ID format')
});

/**
 * @openapi
 * /api/whatsapp/pair-code:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Request pairing code
 *     description: Request a pairing code for the authenticated teacher's phone number.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone:
 *                 type: string
 *                 pattern: '^\\+?[1-9]\\d{6,14}$'
 *                 description: Phone number with country code (e.g. +201234567890)
 *     responses:
 *       200:
 *         description: Pairing code generated
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
 *                     code:
 *                       type: string
 *                     phone:
 *                       type: string
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
router.post('/pair-code', async (req, res) => {
  try {
    const parsed = pairCodeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' });
    }

    const teacherId = req.user.id;
    const { phone } = parsed.data;
    const cleaned = normalizePhoneNumber(phone);

    const client = await sessionManager.getOrCreateSession(teacherId, { autoConnect: false });

    // Set pairing mode BEFORE connect so QR expiry timer doesn't fire
    client.pairingCodeMode = true;
    client.clearQrExpiryTimer();

    // Fresh start: logout then connect
    await client.logout();
    await client.connect();

    // Wait for the QR event
    await client.waitForReady(20000);

    // Now safe to request pairing code
    const code = await client.requestPairingCode(cleaned);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({ success: true, data: { code, phone: cleaned } });
  } catch (error) {
    logger.error('Failed to request pairing code', { teacherId: req.user.id, error: error.message });
    res.status(500).json({ success: false, message: 'Failed to generate pairing code' });
  }
});

/**
 * @openapi
 * /api/whatsapp/qr:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Get QR code
 *     description: Retrieve the current QR code for WhatsApp pairing.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: QR code retrieved
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
 *                     qr:
 *                       type: string
 *                       nullable: true
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
router.get('/qr', (req, res) => {
  const status = sessionManager.getTeacherStatus(req.user.id);
  res.json({ success: true, data: { qr: status?.qr || null } });
});

/**
 * @openapi
 * /api/whatsapp/logout:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Logout WhatsApp
 *     description: Log out the current WhatsApp session for the authenticated teacher.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
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
router.post('/logout', async (req, res) => {
  const success = await sessionManager.destroySession(req.user.id, { deleteCredentials: true });
  res.json({ success: true, message: success ? 'Logged out successfully' : 'No active session to logout' });
});

function normalizePhoneNumber(phone = '') {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);

  const countryCodes = { '20': 'EG', '966': 'SA', '971': 'AE', '965': 'KW', '973': 'BH', '974': 'QA', '968': 'OM', '962': 'JO', '961': 'LB', '216': 'TN', '212': 'MA', '213': 'DZ' };

  for (const [code, country] of Object.entries(countryCodes)) {
    if (cleaned.startsWith(code)) {
      // Strip leading 0 after country code (e.g., +20 012... → 2012...)
      const rest = cleaned.substring(code.length);
      if (rest.startsWith('0') && country === 'EG') {
        return code + rest.substring(1);
      }
      return cleaned;
    }
  }

  if (cleaned.startsWith('01')) return `20${cleaned.substring(1)}`;
  if (cleaned.startsWith('0')) return `20${cleaned.substring(1)}`;

  return cleaned;
}

/**
 * @openapi
 * /api/whatsapp/send-to-number:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Send message
 *     description: Send a WhatsApp message to a specific phone number using the teacher's session.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, message]
 *             properties:
 *               phone:
 *                 type: string
 *                 pattern: '^\\+?[1-9]\\d{6,14}$'
 *                 description: Recipient phone number with country code
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 4096
 *                 description: Message text
 *     responses:
 *       200:
 *         description: Message sent
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
 *       503:
 *         description: WhatsApp session not connected
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
router.post('/send-to-number', requirePermission('send_whatsapp'), async (req, res) => {
  try {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' });
    }

    const teacherId = req.user.id;
    const { phone, message } = parsed.data;

    const client = sessionManager.getSession(teacherId);
    if (!client) {
      return res.status(503).json({ success: false, message: 'No WhatsApp session found. Please pair your phone first.' });
    }

    const status = client.getStatus();
    if (status.status !== 'connected') {
      return res.status(503).json({ success: false, message: 'WhatsApp session is not connected. Please scan the QR code again.' });
    }

    const cleaned = normalizePhoneNumber(phone);
    await client.sendMessage(cleaned, message);

    // Auto-pause bot for this conversation when teacher/assistant sends manual message
    try {
      const { data: parent } = await supabase.from('parents').select('id').eq('phone', `+${cleaned}`).maybeSingle();
      if (parent) {
        const { data: conversation } = await supabase.from('conversations')
          .select('id').eq('parent_id', parent.id).eq('teacher_id', teacherId).maybeSingle();
        if (conversation) {
          const pauseHours = 4;
          await supabase.from('conversations').update({
            last_responder_id: teacherId,
            last_responder_type: req.user.role,
            bot_paused_until: new Date(Date.now() + pauseHours * 3600000).toISOString()
          }).eq('id', conversation.id);
        }
      }
    } catch (pauseError) {
      logger.error('Failed to auto-pause bot', { error: pauseError.message });
    }

    // Audit log
    try {
      const { logAudit } = require('../lib/auditLog');
      await logAudit({
        actorId: teacherId,
        actorType: req.user.role === 'teacher' ? 'teacher' : 'assistant',
        teacherId: req.user.teacherId || teacherId,
        action: 'whatsapp_sent',
        entityType: 'conversation',
        metadata: { phone: cleaned, message_length: message.length },
        ipAddress: req.ip
      });
    } catch (auditError) {
      logger.error('Failed to write audit log', { error: auditError.message });
    }

    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    logger.error('Send message error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

// Resume bot for a conversation
/**
 * @openapi
 * /api/whatsapp/bot/resume:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Resume bot
 *     description: Resume the automated bot for a specific conversation.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [conversation_id]
 *             properties:
 *               conversation_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Bot resumed
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
 *         description: Missing conversation_id
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
 *         description: Conversation not found
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
router.post('/bot/resume', async (req, res) => {
  try {
    const { conversation_id } = req.body;
    if (!conversation_id) {
      return res.status(400).json({ success: false, message: 'conversation_id is required' });
    }

    const { data: conversation, error: fetchError } = await supabase
      .from('conversations')
      .select('id, teacher_id')
      .eq('id', conversation_id)
      .eq('teacher_id', req.user.id)
      .single();

    if (fetchError || !conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    const { error } = await supabase
      .from('conversations')
      .update({ bot_paused_until: null })
      .eq('id', conversation_id);

    if (error) throw error;

    logger.info('Bot resumed for conversation', { conversationId: conversation_id });
    res.json({ success: true, message: 'Bot resumed successfully' });
  } catch (error) {
    logger.error('Resume bot error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to resume bot' });
  }
});

/**
 * @openapi
 * /api/whatsapp/conversations:
 *   get:
 *     tags: [WhatsApp]
 *     summary: List conversations
 *     description: Retrieve paginated WhatsApp conversations for the authenticated teacher.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Conversations retrieved
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
router.get('/conversations', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    const { count } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('teacher_id', req.user.id);

    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        parents (name, phone, students (name, student_id)),
        messages (id, direction, content, created_at)
      `)
      .eq('teacher_id', req.user.id)
      .order('last_message_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    res.json({
      success: true,
      data: conversations,
      pagination: { page, limit, total: count }
    });
  } catch (error) {
    logger.error('Get conversations error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching conversations' });
  }
});

/**
 * @openapi
 * /api/whatsapp/sessions:
 *   get:
 *     tags: [WhatsApp]
 *     summary: List all WhatsApp sessions
 *     description: Get status of all WhatsApp sessions (admin only).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions list
 *       401:
 *         description: Unauthorized
 */
router.get('/sessions', requirePermission('manage_settings'), (req, res) => {
  const status = sessionManager.getStatus();
  res.json({ success: true, data: status });
});

/**
 * @openapi
 * /api/whatsapp/sessions/{teacherId}:
 *   delete:
 *     tags: [WhatsApp]
 *     summary: Disconnect teacher's WhatsApp session
 *     description: Force disconnect a specific teacher's WhatsApp session (admin only).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: teacherId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session disconnected
 *       401:
 *         description: Unauthorized
 */
router.delete('/sessions/:teacherId', requirePermission('manage_settings'), async (req, res) => {
  try {
    const parsed = sessionParamsSchema.safeParse(req.params);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: parsed.error.issues[0].message, code: 'VALIDATION_ERROR' });
    }

    const forceLogout = req.query.force === 'true';
    await sessionManager.destroySession(parsed.data.teacherId, { deleteCredentials: forceLogout });
    res.json({ success: true, message: forceLogout ? 'Session logged out' : 'Session disconnected' });
  } catch (error) {
    logger.error('Failed to disconnect session', { teacherId: req.params.teacherId, error: error.message });
    res.status(500).json({ success: false, message: 'Failed to disconnect session' });
  }
});

module.exports = { router, normalizePhoneNumber };
