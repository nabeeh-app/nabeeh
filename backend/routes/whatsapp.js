const express = require('express');
const { z } = require('zod');
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { baileysClient } = require('../lib/baileys');
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

// ============================================================
// Marketing message (configurable via env)
// ============================================================
const MARKETING_MSG_AR = process.env.WHATSAPP_MARKETING_MSG_AR || `مرحباً بك! 👋\n\nأهلاً وسهلاً بحضرتك في *نَبِيه* - المساعد التعليمي الذكي! 🤖✨\n\nللأسف رقمك غير مسجل في نظامنا حالياً، ولكن نحن نرحب بك للانضمام إلى عائلة نَبِيه! 🎓\n\n🌟 *ماذا نقدم لك؟*\n📊 متابعة درجات أطفالك لحظة بلحظة\n📅 تقارير الحضور والغياب اليومية  \n🤖 مساعد ذكي يجيب على استفساراتك 24/7\n📈 تحليل أداء الطلاب وتقارير مفصلة\n💬 تواصل مباشر مع المعلمين\n\n📞 *للاشتراك والاستفسار:*\nتواصل معنا على: ${process.env.WHATSAPP_MARKETING_PHONE || '+201098455410'}\nأو زر موقعنا: ${process.env.WHATSAPP_MARKETING_URL || 'www.nabeeh-ai.com'}\n\nنتطلع لخدمتك وخدمة أطفالك! 🌟\n\n*فريق نَبِيه التعليمي* 🎓`;

const MARKETING_MSG_EN = process.env.WHATSAPP_MARKETING_MSG_EN || `Hello! 👋\n\nWelcome to *Nabeeh* - Your AI-Powered Educational Assistant! 🤖✨\n\nYour number is not registered in our system yet, but we'd love to welcome you to the Nabeeh family! 🎓\n\n🌟 *What we offer:*\n📊 Real-time student grade tracking\n📅 Daily attendance reports\n🤖 24/7 AI assistant for your questions\n📈 Detailed performance analytics\n💬 Direct communication with teachers\n\n📞 *To subscribe or inquire:*\nContact us: ${process.env.WHATSAPP_MARKETING_PHONE || '+201098455410'}\nVisit: ${process.env.WHATSAPP_MARKETING_URL || 'www.nabeeh-ai.com'}\n\nWe look forward to serving you and your children! 🌟\n\n*Nabeeh Educational Team* 🎓`;

// ============================================================
// Incoming message handler (Baileys event)
// ============================================================
baileysClient.on('message', async (msg) => {
  try {
    const from = msg.key.remoteJid;
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
    if (!from || !body) return;
    if (from.endsWith('@g.us') || from.endsWith('@broadcast') || from === 'status@broadcast') return;

    logger.info('Incoming WhatsApp message', { from, bodyLength: body.length });
    const phone = from.split('@')[0];

    await processIncomingMessage(phone, body, from, msg.key.id);
  } catch (error) {
    logger.error('Error handling incoming message', { error: error.message });
  }
});

async function processIncomingMessage(phone, messageContent, remoteJid, messageId) {
  const isEgyptian = phone.startsWith('20');
  const parent = await whatsappQuery.getParentByPhone(`+${phone}`);

  if (!parent) {
    const lastResponse = marketingResponseCache.get(phone);
    if (lastResponse && Date.now() - lastResponse < MARKETING_COOLDOWN) return;
    marketingResponseCache.set(phone, Date.now());

    const marketingMsg = isEgyptian ? MARKETING_MSG_AR : MARKETING_MSG_EN;
    await baileysClient.sendMessage(remoteJid, marketingMsg);
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
    await baileysClient.sendMessage(remoteJid, response.text);
    await whatsappQuery.saveMessage(conversation.id, 'outgoing', response.text, {
      is_automated: true,
      intent: response.intent,
      confidence: response.confidence
    });
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

function getStatusPayload() {
  const { status, qr, phone } = baileysClient.getStatus();
  const messages = {
    connected: 'WhatsApp session connected',
    qr_ready: 'Scan the QR code to finish pairing',
    connecting: 'Connecting to WhatsApp...',
    disconnected: 'WhatsApp session disconnected'
  };
  return { success: true, data: { status: status || 'disconnected', qr: qr || null, phone }, message: messages[status] || messages.disconnected };
}

/**
 * @openapi
 * /api/whatsapp/status:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Get WhatsApp connection status
 *     description: Retrieve the current WhatsApp session status (connected, qr_ready, connecting, disconnected) and QR code if available.
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
  res.json(getStatusPayload());
});

/**
 * @openapi
 * /api/whatsapp/pair:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Start pairing
 *     description: Initiate a new WhatsApp pairing session. This starts the QR code generation process for linking a phone number.
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
    await baileysClient.startPairing();
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json(getStatusPayload());
  } catch (error) {
    logger.error('Failed to start WhatsApp pairing', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to start WhatsApp pairing session' });
  }
});

const pairCodeSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number format')
});

/**
 * @openapi
 * /api/whatsapp/pair-code:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Request pairing code
 *     description: Request a pairing code for a specific phone number. The phone must have WhatsApp installed.
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

    const { phone } = parsed.data;
    const cleaned = normalizePhoneNumber(phone);

    // Set pairing mode BEFORE connect so QR expiry timer doesn't fire
    baileysClient.pairingCodeMode = true;
    baileysClient.clearQrExpiryTimer();

    // Fresh start: logout then connect
    await baileysClient.logout();
    await baileysClient.connect();

    // Wait for the QR event — this means the WebSocket is connected and ready
    await baileysClient.waitForReady(20000);

    // Now safe to request pairing code
    const code = await baileysClient.requestPairingCode(cleaned);

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json({ success: true, data: { code, phone: cleaned } });
  } catch (error) {
    logger.error('Failed to request pairing code', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to generate pairing code' });
  }
});

/**
 * @openapi
 * /api/whatsapp/qr:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Get QR code
 *     description: Retrieve the current QR code for WhatsApp pairing. Returns null if no QR code is available.
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
  const { qr } = baileysClient.getStatus();
  res.json({ success: true, data: { qr: qr || null } });
});

/**
 * @openapi
 * /api/whatsapp/logout:
 *   post:
 *     tags: [WhatsApp]
 *     summary: Logout WhatsApp
 *     description: Log out the current WhatsApp session. This will disconnect from WhatsApp and require re-pairing.
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
  const success = await baileysClient.logout();
  res.json({ success, message: success ? 'Logged out successfully' : 'Logout failed' });
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
 *     description: Send a WhatsApp message to a specific phone number. Requires the send_whatsapp permission. Automatically pauses the bot for the target conversation for 4 hours.
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

    const { phone, message } = parsed.data;
    const { status } = baileysClient.getStatus();
    if (status !== 'connected') {
      return res.status(503).json({ success: false, message: 'WhatsApp session is not connected. Please scan the QR code again.' });
    }
    const cleaned = normalizePhoneNumber(phone);
    await baileysClient.sendMessage(cleaned, message);

    // Auto-pause bot for this conversation when teacher/assistant sends manual message
    try {
      const { data: parent } = await supabase.from('parents').select('id').eq('phone', `+${cleaned}`).maybeSingle();
      if (parent) {
        const { data: conversation } = await supabase.from('conversations')
          .select('id').eq('parent_id', parent.id).eq('teacher_id', req.user.id).maybeSingle();
        if (conversation) {
          const pauseHours = 4;
          await supabase.from('conversations').update({
            last_responder_id: req.user.id,
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
        actorId: req.user.id,
        actorType: req.user.role === 'teacher' ? 'teacher' : 'assistant',
        teacherId: req.user.teacherId || req.user.id,
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
 *     description: Resume the automated bot for a specific conversation. Clears the bot_paused_until flag so the bot can respond to incoming messages again.
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
 *                 description: The conversation to resume the bot for
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
 *     description: Retrieve paginated WhatsApp conversations for the authenticated teacher, ordered by most recent message.
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

module.exports = { router, normalizePhoneNumber };
