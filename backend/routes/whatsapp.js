const express = require('express');
const axios = require('axios');
const { supabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { baileysClient } = require('../lib/baileys');

const router = express.Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Handle incoming messages
baileysClient.on('message', async (msg) => {
  try {
    const from = msg.key.remoteJid;
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text;

    if (!from || !body) return;

    console.log(`📱 Received message from ${from}: ${body}`);

    // Extract phone number 
    const phone = from.split('@')[0];

    // Clean up phone (remove + if present, though Baileys usually gives without + for remoteJid user part)
    // Actually remoteJid is usually "123456789@s.whatsapp.net"

    // Check if it's a status update or group message? (Baileys filter in lib handles fromMe)
    // We should probably filter broadcast/group if not supported
    if (from.includes('broadcast') || from.includes('g.us')) return;

    await processIncomingMessage(phone, body, from, msg.key.id);

  } catch (error) {
    console.error('Error handling incoming message:', error);
  }
});

const processIncomingMessage = async (phone, messageContent, remoteJid, messageId) => {
  // Determine language based on phone number (Egyptian numbers get Arabic, others get English)
  // Phone usually comes as "2010xxxx" for Egypt
  const isEgyptianNumber = phone.startsWith('20');

  console.log(`🔍 Looking for parent with phone: +${phone}`);

  // Find parent by phone number
  const { data: parent, error: parentError } = await supabase
    .from('parents')
    .select(`
        *,
        students (
          *,
          teachers (id, name, business_name)
        )
      `)
    .eq('phone', `+${phone}`) // Database stores as +20...
    .single();

  if (parentError || !parent) {
    console.log(`❌ No parent found for phone: +${phone}`);
    // Send marketing message (Rate limit this in future?)
    // For now, mirroring previous logic but checking if we just sent one might be good.
    // Ignoring that refactor for now to stick to 1:1 replacement behavior-wise.

    const marketingMessage = isEgyptianNumber ?
      `مرحباً بك! 👋

أهلاً وسهلاً بحضرتك في *نَبِيه* - المساعد التعليمي الذكي! 🤖✨

للأسف رقمك غير مسجل في نظامنا حالياً، ولكن نحن نرحب بك للانضمام إلى عائلة نَبِيه! 🎓

🌟 *ماذا نقدم لك؟*
📊 متابعة درجات أطفالك لحظة بلحظة
📅 تقارير الحضور والغياب اليومية  
🤖 مساعد ذكي يجيب على استفساراتك 24/7
📈 تحليل أداء الطلاب وتقارير مفصلة
💬 تواصل مباشر مع المعلمين

📞 *للاشتراك والاستفسار:*
تواصل معنا على: +201098455410
أو زر موقعنا: www.nabeeh-ai.com

نتطلع لخدمتك وخدمة أطفالك! 🌟

*فريق نَبِيه التعليمي* 🎓` :
      `Hello! 👋

Welcome to *Nabeeh* - Your AI-Powered Educational Assistant! 🤖✨

Your number is not registered in our system yet, but we'd love to welcome you to the Nabeeh family! 🎓

🌟 *What we offer:*
📊 Real-time student grade tracking
📅 Daily attendance reports
🤖 24/7 AI assistant for your questions
📈 Detailed performance analytics
💬 Direct communication with teachers

📞 *To subscribe or inquire:*
Contact us: +201098455410
Visit: www.nabeeh-ai.com

We look forward to serving you and your children! 🌟

*Nabeeh Educational Team* 🎓`;

    await baileysClient.sendMessage(remoteJid, marketingMessage);
    return;
  }

  console.log(`✅ Found parent: ${parent.name} (${parent.id})`);

  const teacher = parent.students.teachers;
  const student = parent.students;

  // Find or create conversation
  let { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('parent_id', parent.id)
    .eq('teacher_id', teacher.id)
    .single();

  if (!conversation) {
    const { data: newConversation, error: convError } = await supabase
      .from('conversations')
      .insert([{
        parent_id: parent.id,
        teacher_id: teacher.id,
        whatsapp_chat_id: remoteJid
      }])
      .select()
      .single();

    if (convError) {
      console.error('Error creating conversation:', convError);
      return;
    }
    conversation = newConversation;
  }

  // Save incoming message
  await supabase
    .from('messages')
    .insert([{
      conversation_id: conversation.id,
      direction: 'incoming',
      content: messageContent,
      whatsapp_message_id: messageId
    }]);

  // Process message and generate response
  const response = await processMessage(messageContent, parent, student, teacher);

  if (response) {
    console.log(`📤 Generated response: ${response.intent} (confidence: ${response.confidence})`);

    await baileysClient.sendMessage(remoteJid, response.text);

    await supabase
      .from('messages')
      .insert([{
        conversation_id: conversation.id,
        direction: 'outgoing',
        content: response.text,
        is_automated: true,
        intent: response.intent,
        confidence_score: response.confidence
      }]);
  }
};

// Process message and determine response
const processMessage = async (message, parent, student, teacher) => {
  try {
    const lowerMessage = message.toLowerCase();

    // Check for attendance queries
    if (lowerMessage.includes('حضور') || lowerMessage.includes('غياب') ||
      lowerMessage.includes('attend') || lowerMessage.includes('absent')) {

      const today = new Date().toISOString().split('T')[0];
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', student.id)
        .eq('date', today)
        .single();

      if (attendance) {
        const statusAr = attendance.status === 'present' ? 'حضر' :
          attendance.status === 'absent' ? 'غاب' : 'تأخر';
        const statusEn = attendance.status === 'present' ? 'attended' :
          attendance.status === 'absent' ? 'was absent' : 'was late';

        const responseText = parent.preferred_language === 'ar' ?
          `${student.name} ${statusAr} اليوم` :
          `${student.name} ${statusEn} today`;

        return {
          text: responseText,
          intent: 'attendance_query',
          confidence: 0.9
        };
      } else {
        const responseText = parent.preferred_language === 'ar' ?
          'لم يتم تسجيل الحضور بعد اليوم' :
          'Attendance not recorded yet today';

        return {
          text: responseText,
          intent: 'attendance_query',
          confidence: 0.8
        };
      }
    }

    // Check for specific subject grade queries
    const subjectKeywords = {
      'ar': ['عربي', 'لغة عربية', 'عربية'],
      'en': ['انجليزي', 'لغة انجليزية', 'انجليزية', 'english'],
      'math': ['رياضيات', 'حساب', 'math'],
      'science': ['علوم', 'science'],
      'history': ['تاريخ', 'history'],
      'geography': ['جغرافيا', 'geography']
    };

    let requestedSubject = null;
    for (const [subject, keywords] of Object.entries(subjectKeywords)) {
      for (const keyword of keywords) {
        if (lowerMessage.includes(keyword)) {
          requestedSubject = subject;
          break;
        }
      }
      if (requestedSubject) break;
    }

    // Check for grade queries
    if (lowerMessage.includes('درجة') || lowerMessage.includes('نتيجة') ||
      lowerMessage.includes('grade') || lowerMessage.includes('score') ||
      lowerMessage.includes('علامة') || lowerMessage.includes('معدل') ||
      lowerMessage.includes('درجات') || lowerMessage.includes('الدرجات')) {

      let query = supabase
        .from('grades')
        .select('*')
        .eq('student_id', student.id)
        .eq('is_published', true)
        .order('date', { ascending: false });

      if (requestedSubject) {
        query = query.eq('subject', requestedSubject);
      }

      const { data: recentGrades } = await query.limit(5);

      let allGradesQuery = supabase
        .from('grades')
        .select('subject, percentage, assessment_type')
        .eq('student_id', student.id)
        .eq('is_published', true);

      if (requestedSubject) {
        allGradesQuery = allGradesQuery.eq('subject', requestedSubject);
      }

      const { data: allGrades } = await allGradesQuery;

      if (recentGrades && recentGrades.length > 0) {
        let responseText = '';

        if (parent.preferred_language === 'ar') {
          if (requestedSubject) {
            responseText = `📊 درجات ${student.name} في ${requestedSubject}:\n\n`;
          } else {
            responseText = `📊 درجات ${student.name}:\n\n`;
          }

          responseText += '🔸 آخر الدرجات:\n';
          recentGrades.forEach(grade => {
            const date = new Date(grade.date).toLocaleDateString('ar-EG');
            responseText += `• ${grade.subject}: ${grade.score}/${grade.max_score} (${grade.percentage}%) - ${date}\n`;
          });

          if (allGrades && allGrades.length > 0) {
            if (requestedSubject) {
              const avg = allGrades.reduce((sum, grade) => sum + grade.percentage, 0) / allGrades.length;
              responseText += `\n📈 المعدل في ${requestedSubject}: ${avg.toFixed(1)}%`;
            } else {
              const overallAvg = allGrades.reduce((sum, grade) => sum + grade.percentage, 0) / allGrades.length;
              responseText += `\n🎯 المعدل العام: ${overallAvg.toFixed(1)}%`;
            }
          }
        } else {
          if (requestedSubject) {
            responseText = `📊 Grades for ${student.name} in ${requestedSubject}:\n\n`;
          } else {
            responseText = `📊 Grades for ${student.name}:\n\n`;
          }

          responseText += '🔸 Recent Grades:\n';
          recentGrades.forEach(grade => {
            const date = new Date(grade.date).toLocaleDateString('en-US');
            responseText += `• ${grade.subject}: ${grade.score}/${grade.max_score} (${grade.percentage}%) - ${date}\n`;
          });

          if (allGrades && allGrades.length > 0) {
            if (requestedSubject) {
              const avg = allGrades.reduce((sum, grade) => sum + grade.percentage, 0) / allGrades.length;
              responseText += `\n📈 Average in ${requestedSubject}: ${avg.toFixed(1)}%`;
            } else {
              const overallAvg = allGrades.reduce((sum, grade) => sum + grade.percentage, 0) / allGrades.length;
              responseText += `\n🎯 Overall Average: ${overallAvg.toFixed(1)}%`;
            }
          }
        }

        return {
          text: responseText,
          intent: 'grade_query',
          confidence: 0.9
        };
      } else {
        const responseText = parent.preferred_language === 'ar' ?
          (requestedSubject ? `لا توجد درجات منشورة في ${requestedSubject} حتى الآن` : 'لا توجد درجات منشورة حتى الآن') :
          (requestedSubject ? `No published grades in ${requestedSubject} yet` : 'No published grades yet');

        return {
          text: responseText,
          intent: 'grade_query',
          confidence: 0.8
        };
      }
    }

    // Check for help queries
    if (lowerMessage.includes('مساعدة') || lowerMessage.includes('help') ||
      lowerMessage.includes('ماذا يمكنني') || lowerMessage.includes('what can i')) {

      const responseText = parent.preferred_language === 'ar' ?
        `مرحباً ${parent.name}! 👋\n\nيمكنني مساعدتك في:\n\n📊 *الدرجات:*\n• "درجات ابني" - لرؤية جميع الدرجات\n• "درجات الرياضيات" - لدرجات مادة معينة\n• "معدل ابني" - للمعدل العام\n\n📅 *الحضور:*\n• "حضور ابني" - لمعرفة حالة الحضور اليوم\n• "غياب ابني" - لمعرفة حالة الغياب\n\n❓ *للمساعدة:*\n• "مساعدة" - لعرض هذه الرسالة\n\nأي سؤال آخر، سأحاول مساعدتك! 😊` :
        `Hello ${parent.name}! 👋\n\nI can help you with:\n\n📊 *Grades:*\n• "My child's grades" - to see all grades\n• "Math grades" - for specific subject grades\n• "My child's average" - for overall average\n\n📅 *Attendance:*\n• "My child's attendance" - to check today's attendance\n• "My child's absence" - to check absence status\n\n❓ *For Help:*\n• "help" - to show this message\n\nAny other questions, I'll try to help! 😊`;

      return {
        text: responseText,
        intent: 'help_query',
        confidence: 0.9
      };
    }

    // Check FAQs
    const { data: faqs } = await supabase
      .from('faqs')
      .select('*')
      .eq('teacher_id', teacher.id)
      .eq('language', parent.preferred_language)
      .eq('is_active', true);

    if (faqs) {
      for (const faq of faqs) {
        const patterns = faq.question_patterns;
        for (const pattern of patterns) {
          if (lowerMessage.includes(pattern.toLowerCase())) {
            await supabase
              .from('faqs')
              .update({ usage_count: faq.usage_count + 1 })
              .eq('id', faq.id);

            return {
              text: faq.answer,
              intent: 'faq',
              confidence: 0.7
            };
          }
        }
      }
    }

    // Use Gemini AI
    return await generateAIResponse(message, parent, student, teacher);

  } catch (error) {
    console.error('Message processing error:', error);
    return {
      text: parent.preferred_language === 'ar' ?
        'عذراً، حدث خطأ في معالجة رسالتك' :
        'Sorry, there was an error processing your message',
      intent: 'error',
      confidence: 0.0
    };
  }
};

// Generate AI response using Gemini
const generateAIResponse = async (message, parent, student, teacher) => {
  try {
    const context = `You are ${teacher.name}, a professional teacher using Nabeeh - an AI-powered teaching assistant. You're responding to ${parent.name}, parent of ${student.name}.
    Respond in ${parent.preferred_language === 'ar' ? 'Arabic' : 'English'}.
    Keep responses helpful, professional, and educational.
    You teach ${student.subjects?.join(', ') || 'various subjects'}.
    Business: ${teacher.business_name || teacher.name}
    
    Important Guidelines:
    1. Maintain professional teacher-parent communication standards
    2. Protect student privacy - never share personal information
    3. Focus on educational support and student progress
    4. Be respectful and culturally appropriate
    5. Provide accurate information based on the student's data
    6. If you don't know something, acknowledge it honestly
    7. Keep responses clear and helpful for parents`;

    const prompt = `${context}\n\nParent message: ${message}\n\nYour professional educational response:`;

    const response = await axios.post(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    });

    const aiText = response.data.candidates[0]?.content?.parts[0]?.text;

    if (aiText) {
      return {
        text: aiText,
        intent: 'general',
        confidence: 0.6
      };
    }

    return null;
  } catch (error) {
    console.error('AI response error:', error);
    return null;
  }
};


// Routes
router.use(authenticateToken);

const getStatusPayload = () => {
  const { status, qr } = baileysClient.getStatus();
  let message = 'WhatsApp session disconnected';

  switch (status) {
    case 'connected':
      message = 'WhatsApp session connected';
      break;
    case 'qr_ready':
      message = 'Scan the QR code to finish pairing';
      break;
    case 'connecting':
      message = 'Connecting to WhatsApp...';
      break;
    default:
      break;
  }

  return { success: true, status: status || 'disconnected', qr: qr || null, message };
};

router.get('/status', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.json(getStatusPayload());
});

router.post('/status', (req, res) => {
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
    console.error('Failed to start WhatsApp pairing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start WhatsApp pairing session'
    });
  }
});

router.get('/qr', (req, res) => {
  const { qr } = baileysClient.getStatus();
  res.json({
    success: true,
    qr: qr || null
  });
});

// Logout
router.post('/logout', async (req, res) => {
  const success = await baileysClient.logout();
  res.json({
    success,
    message: success ? 'Logged out successfully' : 'Logout failed'
  });
});

const normalizePhoneNumber = (phone = '') => {
  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('01')) {
    cleaned = `20${cleaned.substring(1)}`;
  } else if (cleaned.startsWith('0')) {
    cleaned = `20${cleaned.substring(1)}`;
  }

  if (!cleaned.startsWith('20') && !cleaned.startsWith('2')) {
    cleaned = `20${cleaned}`;
  }

  return cleaned;
};

const handleSendMessage = async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ success: false, message: 'Phone and message are required' });
    }

    const { status } = baileysClient.getStatus();
    if (status !== 'connected') {
      return res.status(503).json({
        success: false,
        message: 'WhatsApp session is not connected. Please scan the QR code again.'
      });
    }

    const cleaned = normalizePhoneNumber(phone);
    await baileysClient.sendMessage(cleaned, message);

    res.json({ success: true, message: 'Message sent successfully' });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, message: 'Failed to send message' });
  }
};

router.post('/send-to-number', handleSendMessage);
router.post('/send-test', handleSendMessage);

// Get Conversations (Supabase Only - Unchanged logic mostly)
router.get('/conversations', async (req, res) => {
  try {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
            *,
            parents (
              name,
              phone,
              students (name, student_id)
            ),
            messages (
              id,
              direction,
              content,
              created_at
            )
          `)
      .eq('teacher_id', req.user.id)
      .order('last_message_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching conversations'
    });
  }
});

module.exports = { router };
