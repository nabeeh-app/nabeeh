const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { baileysClient } = require('../lib/baileys');
const logger = require('../lib/logger');
const whatsappQuery = require('../lib/whatsappQuery');
const messageParser = require('../lib/messageParser');
const aiResponder = require('../lib/aiResponder');

const router = express.Router();

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
    if (from.includes('broadcast') || from.includes('g.us')) return;

    logger.info('Incoming WhatsApp message', { from, body });
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

  await whatsappQuery.saveMessage(conversation.id, 'incoming', messageContent, { whatsapp_message_id: messageId });

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
  const { status, qr } = baileysClient.getStatus();
  const messages = {
    connected: 'WhatsApp session connected',
    qr_ready: 'Scan the QR code to finish pairing',
    connecting: 'Connecting to WhatsApp...',
    disconnected: 'WhatsApp session disconnected'
  };
  return { success: true, data: { status: status || 'disconnected', qr: qr || null }, message: messages[status] || messages.disconnected };
}

router.get('/status', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.json(getStatusPayload());
});

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

router.get('/qr', (req, res) => {
  const { qr } = baileysClient.getStatus();
  res.json({ success: true, data: { qr: qr || null } });
});

router.post('/logout', async (req, res) => {
  const success = await baileysClient.logout();
  res.json({ success, message: success ? 'Logged out successfully' : 'Logout failed' });
});

function normalizePhoneNumber(phone = '') {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('01')) cleaned = `20${cleaned.substring(1)}`;
  else if (cleaned.startsWith('0')) cleaned = `20${cleaned.substring(1)}`;
  if (!cleaned.startsWith('20') && !cleaned.startsWith('2')) cleaned = `20${cleaned}`;
  return cleaned;
}

router.post('/send-to-number', async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ success: false, message: 'Phone and message are required' });
    }
    const { status } = baileysClient.getStatus();
    if (status !== 'connected') {
      return res.status(503).json({ success: false, message: 'WhatsApp session is not connected. Please scan the QR code again.' });
    }
    const cleaned = normalizePhoneNumber(phone);
    await baileysClient.sendMessage(cleaned, message);
    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    logger.error('Send message error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
});

router.get('/conversations', async (req, res) => {
  try {
    const { data: conversations, error } = await require('../config/database').supabase
      .from('conversations')
      .select(`
        *,
        parents (name, phone, students (name, student_id)),
        messages (id, direction, content, created_at)
      `)
      .eq('teacher_id', req.user.id)
      .order('last_message_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: conversations });
  } catch (error) {
    logger.error('Get conversations error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching conversations' });
  }
});

module.exports = { router };
