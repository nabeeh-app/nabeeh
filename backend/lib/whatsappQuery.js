const { supabase } = require('../config/database');
const logger = require('./logger');

/**
 * Find parent by phone number with student and teacher joins
 */
async function getParentByPhone(phone) {
  const { data: parent, error } = await supabase
    .from('parents')
    .select(`
      *,
      students (
        *,
        teachers (id, name, business_name)
      )
    `)
    .eq('phone', phone)
    .single();

  if (error || !parent) return null;
  return parent;
}

/**
 * Find or create a conversation between parent and teacher
 */
async function findOrCreateConversation(parentId, teacherId, chatId) {
  let { data: conversation } = await supabase
    .from('conversations')
    .select('*')
    .eq('parent_id', parentId)
    .eq('teacher_id', teacherId)
    .single();

  if (!conversation) {
    const { data: newConversation, error } = await supabase
      .from('conversations')
      .insert([{
        parent_id: parentId,
        teacher_id: teacherId,
        whatsapp_chat_id: chatId
      }])
      .select()
      .single();

    if (error) {
      logger.error('Error creating conversation', { error: error.message });
      return null;
    }
    conversation = newConversation;
  }

  return conversation;
}

/**
 * Save a message to the database
 */
async function saveMessage(conversationId, direction, content, meta = {}) {
  const { error } = await supabase
    .from('messages')
    .insert([{
      conversation_id: conversationId,
      direction,
      content,
      ...meta
    }]);

  if (error) {
    logger.error('Error saving message', { error: error.message });
  }
}

/**
 * Get student attendance for today
 */
async function getStudentAttendance(studentId) {
  const today = new Date().toISOString().split('T')[0];
  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('student_id', studentId)
    .eq('date', today)
    .single();

  return attendance;
}

/**
 * Get student grades (recent + all for average)
 */
async function getStudentGrades(studentId, subject) {
  let query = supabase
    .from('grades')
    .select('*')
    .eq('student_id', studentId)
    .eq('is_published', true)
    .order('date', { ascending: false });

  if (subject) {
    query = query.eq('subject', subject);
  }

  const { data: recentGrades } = await query.limit(5);

  let allQuery = supabase
    .from('grades')
    .select('subject, percentage, assessment_type')
    .eq('student_id', studentId)
    .eq('is_published', true);

  if (subject) {
    allQuery = allQuery.eq('subject', subject);
  }

  const { data: allGrades } = await allQuery;

  return { recentGrades, allGrades };
}

/**
 * Get teacher FAQs matching a pattern
 */
async function getMatchingFaq(teacherId, language, messageText) {
  const { data: faqs } = await supabase
    .from('faqs')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('language', language)
    .eq('is_active', true);

  if (!faqs) return null;

  const lowerMessage = messageText.toLowerCase();
  for (const faq of faqs) {
    const patterns = faq.question_patterns || [];
    for (const pattern of patterns) {
      if (lowerMessage.includes(pattern.toLowerCase())) {
        await supabase
          .from('faqs')
          .update({ usage_count: (faq.usage_count || 0) + 1 })
          .eq('id', faq.id);
        return faq;
      }
    }
  }

  return null;
}

module.exports = {
  getParentByPhone,
  findOrCreateConversation,
  saveMessage,
  getStudentAttendance,
  getStudentGrades,
  getMatchingFaq
};
