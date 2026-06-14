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
        enrollments (
          id,
          group:groups (
            id,
            offering:offerings (
              id,
              teacher_id,
              teacher:teachers (id, name, business_name)
            )
          )
        )
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
 * Save a message to the database and update last_message_at
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

  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);
}

/**
 * Get student attendance for today
 */
async function getStudentAttendance(studentId) {
  const today = new Date().toISOString().split('T')[0];
  const { data: attendance } = await supabase
    .from('attendance')
    .select('*, session:sessions!inner(date)')
    .eq('enrollment.student_id', studentId)
    .eq('session.date', today)
    .single();

  return attendance;
}

/**
 * Flatten grade query results into simple objects for response formatting
 */
function flattenGrades(rawGrades) {
  return (rawGrades || []).map(g => ({
    subject: g.enrollment?.group?.offering?.subject?.name_en
      || g.enrollment?.group?.offering?.subject?.name_ar
      || 'Unknown',
    score: g.score,
    max_score: g.assessment?.max_score,
    percentage: g.assessment?.max_score
      ? ((g.score / g.assessment.max_score) * 100).toFixed(1)
      : 'N/A',
    date: g.assessment?.date,
    type: g.assessment?.type
  }));
}

/**
 * Flatten all grades for average calculation
 */
function flattenAllGrades(rawGrades) {
  return (rawGrades || []).map(g => ({
    score: g.score,
    max_score: g.assessment?.max_score,
    percentage: g.assessment?.max_score
      ? (g.score / g.assessment.max_score) * 100
      : 0
  }));
}

/**
 * Get student grades (recent + all for average)
 */
async function getStudentGrades(studentId, subject) {
  let query = supabase
    .from('grades')
    .select(`
      *,
      assessment:assessments!inner(name, max_score, date, type),
      enrollment:enrollments!inner(student_id, group:groups!inner(offering:offerings!inner(subject:subjects!inner(name_en, name_ar, code))))
    `)
    .eq('enrollment.student_id', studentId)
    .order('created_at', { ascending: false });

  if (subject) {
    query = query.or(`enrollment.group.offering.subject.name_en.ilike.${subject},enrollment.group.offering.subject.name_ar.ilike.${subject},enrollment.group.offering.subject.code.ilike.${subject}`);
  }

  const { data: recentGradesRaw } = await query.limit(5);
  const recentGrades = flattenGrades(recentGradesRaw);

  let allQuery = supabase
    .from('grades')
    .select(`
      score,
      assessment:assessments!inner(max_score, type),
      enrollment:enrollments!inner(student_id, group:groups!inner(offering:offerings!inner(subject:subjects!inner(name_en, code))))
    `)
    .eq('enrollment.student_id', studentId);

  if (subject) {
    allQuery = allQuery.or(`enrollment.group.offering.subject.name_en.ilike.${subject},enrollment.group.offering.subject.code.ilike.${subject}`);
  }

  const { data: allGradesRaw } = await allQuery;
  const allGrades = flattenAllGrades(allGradesRaw);

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
