const express = require('express');
const router = express.Router();

const TEACHER_ID = '550e8400-e29b-41d4-a716-446655440000';
const nowISO = () => new Date().toISOString();
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };

const GROUP_A_ID = '660e8400-e29b-41d4-a716-446655440010';
const GROUP_B_ID = '660e8400-e29b-41d4-a716-446655440011';
const GROUP_C_ID = '660e8400-e29b-41d4-a716-446655440012';

const mockStudents = [
  { id: '880e8400-e29b-41d4-a716-446655440030', teacher_id: TEACHER_ID, student_id: 'ST001', name: 'أحمد محمد علي', grade_level: '1st Secondary', group_id: GROUP_A_ID, date_of_birth: '2010-03-15', gender: 'male', subjects: ['Mathematics'], enrollment_date: daysAgo(60), status: 'active', notes: null, emergency_contact: '+201098765432', address: 'المعادي، القاهرة', created_at: daysAgo(60), updated_at: nowISO(), parents: [{ id: 'aa0e8400-e29b-41d4-a716-446655440040', name: 'محمد علي', phone: '+201098765432', is_primary: true, relationship: 'father', preferred_language: 'ar' }] },
  { id: '880e8400-e29b-41d4-a716-446655440031', teacher_id: TEACHER_ID, student_id: 'ST002', name: 'فاطمة أحمد', grade_level: '1st Secondary', group_id: GROUP_A_ID, date_of_birth: '2010-07-22', gender: 'female', subjects: ['Mathematics'], enrollment_date: daysAgo(55), status: 'active', notes: 'متفوقة في الامتحانات', emergency_contact: '+201087654321', address: 'الزمالك، القاهرة', created_at: daysAgo(55), updated_at: nowISO(), parents: [{ id: 'aa0e8400-e29b-41d4-a716-446655440041', name: 'أحمد فاطمة', phone: '+201087654321', is_primary: true, relationship: 'father', preferred_language: 'ar' }] },
  { id: '880e8400-e29b-41d4-a716-446655440032', teacher_id: TEACHER_ID, student_id: 'ST003', name: 'عمر حسن', grade_level: '1st Secondary', group_id: GROUP_B_ID, date_of_birth: '2010-01-10', gender: 'male', subjects: ['Mathematics'], enrollment_date: daysAgo(45), status: 'active', notes: null, emergency_contact: '+201076543210', address: 'مصر الجديدة، القاهرة', created_at: daysAgo(45), updated_at: nowISO(), parents: [{ id: 'aa0e8400-e29b-41d4-a716-446655440042', name: 'حسن أحمد', phone: '+201076543210', is_primary: true, relationship: 'father', preferred_language: 'ar' }] },
  { id: '880e8400-e29b-41d4-a716-446655440033', teacher_id: TEACHER_ID, student_id: 'ST004', name: 'نور محمد', grade_level: '1st Secondary', group_id: GROUP_B_ID, date_of_birth: '2010-11-05', gender: 'female', subjects: ['Mathematics'], enrollment_date: daysAgo(40), status: 'active', notes: null, emergency_contact: '+201065432109', address: 'الرحاب، القاهرة', created_at: daysAgo(40), updated_at: nowISO(), parents: [{ id: 'aa0e8400-e29b-41d4-a716-446655440043', name: 'محمد نور', phone: '+201065432109', is_primary: true, relationship: 'father', preferred_language: 'en' }] },
  { id: '880e8400-e29b-41d4-a716-446655440034', teacher_id: TEACHER_ID, student_id: 'ST005', name: 'يوسف إبراهيم', grade_level: '2nd Secondary', group_id: GROUP_C_ID, date_of_birth: '2009-05-18', gender: 'male', subjects: ['Physics'], enrollment_date: daysAgo(30), status: 'active', notes: null, emergency_contact: '+201054321098', address: 'التجمع الخامس، القاهرة', created_at: daysAgo(30), updated_at: nowISO(), parents: [{ id: 'aa0e8400-e29b-41d4-a716-446655440044', name: 'إبراهيم يوسف', phone: '+201054321098', is_primary: true, relationship: 'father', preferred_language: 'ar' }] },
  { id: '880e8400-e29b-41d4-a716-446655440035', teacher_id: TEACHER_ID, student_id: 'ST006', name: 'سارة خالد', grade_level: '2nd Secondary', group_id: GROUP_C_ID, date_of_birth: '2009-09-25', gender: 'female', subjects: ['Physics'], enrollment_date: daysAgo(25), status: 'active', notes: 'تحتاج متابعة إضافية', emergency_contact: '+201043210987', address: 'المهندسين، الجيزة', created_at: daysAgo(25), updated_at: nowISO(), parents: [{ id: 'aa0e8400-e29b-41d4-a716-446655440045', name: 'خالد سارة', phone: '+201043210987', is_primary: true, relationship: 'father', preferred_language: 'ar' }] },
  { id: '880e8400-e29b-41d4-a716-446655440036', teacher_id: TEACHER_ID, student_id: 'ST007', name: 'مريم حسين', grade_level: '3rd Secondary', group_id: '660e8400-e29b-41d4-a716-446655440013', date_of_birth: '2008-12-01', gender: 'female', subjects: ['Arabic'], enrollment_date: daysAgo(90), status: 'active', notes: null, emergency_contact: '+201032109876', address: 'حلوان، القاهرة', created_at: daysAgo(90), updated_at: nowISO(), parents: [{ id: 'aa0e8400-e29b-41d4-a716-446655440046', name: 'حسين مريم', phone: '+201032109876', is_primary: true, relationship: 'father', preferred_language: 'ar' }] },
  { id: '880e8400-e29b-41d4-a716-446655440037', teacher_id: TEACHER_ID, student_id: 'ST008', name: 'عثمان أحمد', grade_level: '1st Secondary', group_id: GROUP_A_ID, date_of_birth: '2010-06-30', gender: 'male', subjects: ['Mathematics'], enrollment_date: daysAgo(100), status: 'inactive', notes: 'انتقل إلى مدينة أخرى', emergency_contact: '+201021098765', address: 'الإسكندرية', created_at: daysAgo(100), updated_at: nowISO(), parents: [{ id: 'aa0e8400-e29b-41d4-a716-446655440047', name: 'أحمد عثمان', phone: '+201021098765', is_primary: true, relationship: 'father', preferred_language: 'ar' }] },
];

const mockOfferings = [
  { id: '770e8400-e29b-41d4-a716-446655440020', academic_year: '2025-2026', is_active: true, subject: { name_en: 'Mathematics', name_ar: 'الرياضيات', code: 'MATH' }, grade_level: { name: '1st Secondary', order: 1 }, groups: [{ id: GROUP_A_ID, name: 'المجموعة أ', schedule_description: 'السبت والأحد 10:00-12:00' }, { id: GROUP_B_ID, name: 'المجموعة ب', schedule_description: 'السبت والأحد 1:00-3:00' }] },
  { id: '770e8400-e29b-41d4-a716-446655440021', academic_year: '2025-2026', is_active: true, subject: { name_en: 'Physics', name_ar: 'الفيزياء', code: 'PHYS' }, grade_level: { name: '2nd Secondary', order: 2 }, groups: [{ id: GROUP_C_ID, name: 'المجموعة أ', schedule_description: 'الاثنين والأربعاء 4:00-6:00' }] },
  { id: '770e8400-e29b-41d4-a716-446655440022', academic_year: '2025-2026', is_active: true, subject: { name_en: 'Arabic', name_ar: 'اللغة العربية', code: 'ARAB' }, grade_level: { name: '3rd Secondary', order: 3 }, groups: [{ id: '660e8400-e29b-41d4-a716-446655440013', name: 'المجموعة أ', schedule_description: 'الثلاثاء والخميس 2:00-4:00' }] },
];

const mockAttendance = (() => {
  const records = [];
  const statuses = ['present', 'present', 'present', 'present', 'absent', 'late', 'present', 'excused'];
  const activeStudents = mockStudents.filter((s) => s.status === 'active');
  for (let day = 0; day < 7; day++) {
    activeStudents.forEach((student, i) => {
      records.push({ id: `att-${day}-${i}`, student_id: student.id, teacher_id: TEACHER_ID, group_id: student.group_id, date: daysAgo(day), status: statuses[(i + day) % statuses.length], notes: null, created_at: daysAgo(day), updated_at: daysAgo(day), student });
    });
  }
  return records;
})();

const mockGrades = [
  { id: '990e8400-e29b-41d4-a716-446655440050', student_id: '880e8400-e29b-41d4-a716-446655440030', teacher_id: TEACHER_ID, group_id: GROUP_A_ID, subject: 'Mathematics', assessment_type: 'quiz', assessment_name: 'Quiz 1', score: 85, max_score: 100, percentage: 85, letter_grade: 'A', date: daysAgo(30), notes: null, created_at: daysAgo(30), updated_at: daysAgo(30), student: mockStudents[0] },
  { id: '990e8400-e29b-41d4-a716-446655440051', student_id: '880e8400-e29b-41d4-a716-446655440031', teacher_id: TEACHER_ID, group_id: GROUP_A_ID, subject: 'Mathematics', assessment_type: 'quiz', assessment_name: 'Quiz 1', score: 92, max_score: 100, percentage: 92, letter_grade: 'A+', date: daysAgo(30), notes: null, created_at: daysAgo(30), updated_at: daysAgo(30), student: mockStudents[1] },
  { id: '990e8400-e29b-41d4-a716-446655440052', student_id: '880e8400-e29b-41d4-a716-446655440032', teacher_id: TEACHER_ID, group_id: GROUP_B_ID, subject: 'Mathematics', assessment_type: 'midterm', assessment_name: 'Midterm', score: 78, max_score: 100, percentage: 78, letter_grade: 'C+', date: daysAgo(20), notes: null, created_at: daysAgo(20), updated_at: daysAgo(20), student: mockStudents[2] },
  { id: '990e8400-e29b-41d4-a716-446655440053', student_id: '880e8400-e29b-41d4-a716-446655440033', teacher_id: TEACHER_ID, group_id: GROUP_B_ID, subject: 'Mathematics', assessment_type: 'midterm', assessment_name: 'Midterm', score: 88, max_score: 100, percentage: 88, letter_grade: 'A', date: daysAgo(20), notes: null, created_at: daysAgo(20), updated_at: daysAgo(20), student: mockStudents[3] },
  { id: '990e8400-e29b-41d4-a716-446655440054', student_id: '880e8400-e29b-41d4-a716-446655440030', teacher_id: TEACHER_ID, group_id: GROUP_A_ID, subject: 'Mathematics', assessment_type: 'homework', assessment_name: 'HW 1', score: 45, max_score: 50, percentage: 90, letter_grade: 'A', date: daysAgo(15), notes: null, created_at: daysAgo(15), updated_at: daysAgo(15), student: mockStudents[0] },
  { id: '990e8400-e29b-41d4-a716-446655440055', student_id: '880e8400-e29b-41d4-a716-446655440031', teacher_id: TEACHER_ID, group_id: GROUP_A_ID, subject: 'Mathematics', assessment_type: 'homework', assessment_name: 'HW 1', score: 48, max_score: 50, percentage: 96, letter_grade: 'A+', date: daysAgo(15), notes: null, created_at: daysAgo(15), updated_at: daysAgo(15), student: mockStudents[1] },
  { id: '990e8400-e29b-41d4-a716-446655440056', student_id: '880e8400-e29b-41d4-a716-446655440034', teacher_id: TEACHER_ID, group_id: GROUP_C_ID, subject: 'Physics', assessment_type: 'quiz', assessment_name: 'Quiz 1', score: 72, max_score: 100, percentage: 72, letter_grade: 'C', date: daysAgo(28), notes: null, created_at: daysAgo(28), updated_at: daysAgo(28), student: mockStudents[4] },
  { id: '990e8400-e29b-41d4-a716-446655440057', student_id: '880e8400-e29b-41d4-a716-446655440035', teacher_id: TEACHER_ID, group_id: GROUP_C_ID, subject: 'Physics', assessment_type: 'quiz', assessment_name: 'Quiz 1', score: 65, max_score: 100, percentage: 65, letter_grade: 'C', date: daysAgo(28), notes: null, created_at: daysAgo(28), updated_at: daysAgo(28), student: mockStudents[5] },
  { id: '990e8400-e29b-41d4-a716-446655440058', student_id: '880e8400-e29b-41d4-a716-446655440034', teacher_id: TEACHER_ID, group_id: GROUP_C_ID, subject: 'Physics', assessment_type: 'midterm', assessment_name: 'Midterm', score: 81, max_score: 100, percentage: 81, letter_grade: 'B+', date: daysAgo(18), notes: null, created_at: daysAgo(18), updated_at: daysAgo(18), student: mockStudents[4] },
  { id: '990e8400-e29b-41d4-a716-446655440059', student_id: '880e8400-e29b-41d4-a716-446655440035', teacher_id: TEACHER_ID, group_id: GROUP_C_ID, subject: 'Physics', assessment_type: 'midterm', assessment_name: 'Midterm', score: 74, max_score: 100, percentage: 74, letter_grade: 'C+', date: daysAgo(18), notes: null, created_at: daysAgo(18), updated_at: daysAgo(18), student: mockStudents[5] },
  { id: '990e8400-e29b-41d4-a716-446655440060', student_id: '880e8400-e29b-41d4-a716-446655440036', teacher_id: TEACHER_ID, group_id: '660e8400-e29b-41d4-a716-446655440013', subject: 'Arabic', assessment_type: 'quiz', assessment_name: 'Quiz 1', score: 90, max_score: 100, percentage: 90, letter_grade: 'A+', date: daysAgo(25), notes: null, created_at: daysAgo(25), updated_at: daysAgo(25), student: mockStudents[6] },
  { id: '990e8400-e29b-41d4-a716-446655440061', student_id: '880e8400-e29b-41d4-a716-446655440036', teacher_id: TEACHER_ID, group_id: '660e8400-e29b-41d4-a716-446655440013', subject: 'Arabic', assessment_type: 'final', assessment_name: 'Final', score: 88, max_score: 100, percentage: 88, letter_grade: 'A', date: daysAgo(5), notes: null, created_at: daysAgo(5), updated_at: daysAgo(5), student: mockStudents[6] },
  { id: '990e8400-e29b-41d4-a716-446655440062', student_id: '880e8400-e29b-41d4-a716-446655440030', teacher_id: TEACHER_ID, group_id: GROUP_A_ID, subject: 'Mathematics', assessment_type: 'final', assessment_name: 'Final', score: 91, max_score: 100, percentage: 91, letter_grade: 'A+', date: daysAgo(3), notes: null, created_at: daysAgo(3), updated_at: daysAgo(3), student: mockStudents[0] },
  { id: '990e8400-e29b-41d4-a716-446655440063', student_id: '880e8400-e29b-41d4-a716-446655440031', teacher_id: TEACHER_ID, group_id: GROUP_A_ID, subject: 'Mathematics', assessment_type: 'final', assessment_name: 'Final', score: 95, max_score: 100, percentage: 95, letter_grade: 'A+', date: daysAgo(3), notes: null, created_at: daysAgo(3), updated_at: daysAgo(3), student: mockStudents[1] },
  { id: '990e8400-e29b-41d4-a716-446655440064', student_id: '880e8400-e29b-41d4-a716-446655440034', teacher_id: TEACHER_ID, group_id: GROUP_C_ID, subject: 'Physics', assessment_type: 'final', assessment_name: 'Final', score: 79, max_score: 100, percentage: 79, letter_grade: 'C+', date: daysAgo(2), notes: null, created_at: daysAgo(2), updated_at: daysAgo(2), student: mockStudents[4] },
];

const mockConversations = [
  { id: 'bb0e8400-e29b-41d4-a716-446655440070', teacher_id: TEACHER_ID, parent_phone: '+201098765432', parent_name: 'محمد علي', student_name: 'أحمد محمد علي', last_message_at: daysAgo(0), is_active: true, created_at: daysAgo(30), updated_at: daysAgo(0), message_count: 8, latest_message: 'شكراً جزيلاً' },
  { id: 'bb0e8400-e29b-41d4-a716-446655440071', teacher_id: TEACHER_ID, parent_phone: '+201087654321', parent_name: 'أحمد فاطمة', student_name: 'فاطمة أحمد', last_message_at: daysAgo(1), is_active: true, created_at: daysAgo(25), updated_at: daysAgo(1), message_count: 5, latest_message: 'هل هناك واجبات إضافية؟' },
  { id: 'bb0e8400-e29b-41d4-a716-446655440072', teacher_id: TEACHER_ID, parent_phone: '+201054321098', parent_name: 'إبراهيم يوسف', student_name: 'يوسف إبراهيم', last_message_at: daysAgo(1), is_active: true, created_at: daysAgo(15), updated_at: daysAgo(1), message_count: 3, latest_message: 'تمام، شكراً' },
  { id: 'bb0e8400-e29b-41d4-a716-446655440073', teacher_id: TEACHER_ID, parent_phone: '+201043210987', parent_name: 'خالد سارة', student_name: 'سارة خالد', last_message_at: daysAgo(2), is_active: false, created_at: daysAgo(20), updated_at: daysAgo(2), message_count: 2, latest_message: 'حسناً' },
  { id: 'bb0e8400-e29b-41d4-a716-446655440074', teacher_id: TEACHER_ID, parent_phone: '+201032109876', parent_name: 'حسين مريم', student_name: 'مريم حسين', last_message_at: daysAgo(3), is_active: true, created_at: daysAgo(10), updated_at: daysAgo(3), message_count: 4, latest_message: 'ما موعد الامتحان القادم؟' },
];

const mockMessages = [
  { id: 'msg-01', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440070', sender_phone: '+201098765432', sender_name: 'محمد علي', content: 'السلام عليكم، كيف حال أحمد في الفصل؟', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(5) },
  { id: 'msg-02', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440070', sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'وعليكم السلام، أحمد ممتاز ويشارك بنشاط في الحصص', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(5) },
  { id: 'msg-03', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440070', sender_phone: '+201098765432', sender_name: 'محمد علي', content: 'هل هناك أي مشاكل يجب أن أعرفها؟', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(4) },
  { id: 'msg-04', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440070', sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'لا، كل شيء على ما يرام. أحمد يحصل على درجات جيدة في الاختبارات الأخيرة.', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(4) },
  { id: 'msg-05', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440070', sender_phone: '+201098765432', sender_name: 'محمد علي', content: 'ممتاز، شكراً على المتابعة', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(3) },
  { id: 'msg-06', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440070', sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'العفو، لا تتردد في التواصل معي في أي وقت', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(3) },
  { id: 'msg-07', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440070', sender_phone: '+201098765432', sender_name: 'محمد علي', content: 'هل يمكنني الحصول على جدول الامتحانات القادمة؟', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(1) },
  { id: 'msg-08', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440070', sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'بالتأكيد، سأرسله لك الآن', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(1) },
  { id: 'msg-09', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440071', sender_phone: '+201087654321', sender_name: 'أحمد فاطمة', content: 'مرحباً، أريد أن أسأل عن تقدم فاطمة', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(3) },
  { id: 'msg-10', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440071', sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'فاطمة متفوقة، حصلت على أعلى درجة في اختبار الرياضيات الأخير', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(3) },
  { id: 'msg-11', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440071', sender_phone: '+201087654321', sender_name: 'أحمد فاطمة', content: 'الحمد لله، هل هناك واجبات إضافية يمكنها עושיםها؟', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(2) },
  { id: 'msg-12', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440071', sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'نعم، سأرسل لها مجموعات إضافية للتدريب', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(2) },
  { id: 'msg-13', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440071', sender_phone: '+201087654321', sender_name: 'أحمد فاطمة', content: 'هل هناك واجبات إضافية؟', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(1) },
  { id: 'msg-14', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440072', sender_phone: '+201054321098', sender_name: 'إبراهيم يوسف', content: 'مرحباً، يوسف يحتاج مساعدة في الفيزياء', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(5) },
  { id: 'msg-15', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440072', sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'سأراجع مع يوسف في الدرس القادم', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(5) },
  { id: 'msg-16', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440072', sender_phone: '+201054321098', sender_name: 'إبراهيم يوسف', content: 'تمام، شكراً', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(1) },
  { id: 'msg-17', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440073', sender_phone: '+201043210987', sender_name: 'خالد سارة', content: 'هل سارة قامت بدفع الرسوم؟', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(5) },
  { id: 'msg-18', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440073', sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'نعم، تم الدفع', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(5) },
  { id: 'msg-19', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440074', sender_phone: '+201032109876', sender_name: 'حسين مريم', content: 'ما موعد الامتحان القادم للغة العربية؟', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(4) },
  { id: 'msg-20', conversation_id: 'bb0e8400-e29b-41d4-a716-446655440074', sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'الامتحان يوم السبت القادم إن شاء الله', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(4) },
];

const mockTeacher = {
  id: TEACHER_ID, email: 'ahmed.hassan@example.com', phone: '+201012345678', name: 'أحمد حسن', role: 'teacher', preferred_language: 'ar', business_name: 'أكاديمية النجاح', logo_url: null, bio: 'مدرس رياضيات وفيزياء للمرحلة الثانوية', subjects: ['Mathematics', 'Physics'], address: 'شارع金字塔، المعادي', city: 'القاهرة', country: 'مصر', timezone: 'Africa/Cairo', whatsapp_number: '+201012345678', telegram_username: '@ahmed_hassan', is_active: true, subscription_plan: 'pro', subscription_expires_at: '2027-01-01T00:00:00.000Z', created_at: '2024-09-01T00:00:00.000Z', updated_at: nowISO(),
};

function paginate(data, page = 1, limit = 50) {
  const total = data.length;
  const pages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  return { success: true, data: data.slice(start, start + limit), pagination: { page, limit, total, pages } };
}

// Auth routes
router.post('/auth/login', (req, res) => {
  res.json({ success: true, data: { teacher: mockTeacher, token: 'mock-jwt-token' }, message: 'Login successful' });
});
router.post('/auth/register', (req, res) => {
  res.json({ success: true, data: { teacher: { ...mockTeacher, name: req.body.name, email: req.body.email }, token: 'mock-jwt-token' }, message: 'Registration successful' });
});
router.get('/auth/me', (req, res) => {
  res.json({ success: true, data: mockTeacher });
});
router.put('/auth/profile', (req, res) => {
  res.json({ success: true, data: { ...mockTeacher, ...req.body } });
});
router.post('/auth/admin/create-teacher', (req, res) => {
  res.json({ success: true, data: { ...mockTeacher, name: req.body.name, email: req.body.email, role: req.body.role || 'teacher' } });
});

// Students routes
router.get('/students', (req, res) => {
  let filtered = [...mockStudents];
  if (req.query.search) { const q = req.query.search.toLowerCase(); filtered = filtered.filter((s) => s.name.includes(q) || s.student_id.includes(q)); }
  if (req.query.grade_level) filtered = filtered.filter((s) => s.grade_level === req.query.grade_level);
  if (req.query.status) filtered = filtered.filter((s) => s.status === req.query.status);
  if (req.query.group_id) filtered = filtered.filter((s) => s.group_id === req.query.group_id);
  res.json(paginate(filtered, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 50));
});
router.get('/students/:id', (req, res) => {
  const student = mockStudents.find((s) => s.id === req.params.id);
  if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
  res.json({ success: true, data: student });
});
router.get('/students/:id/stats', (req, res) => {
  res.json({ success: true, data: { attendance: { present: 18, absent: 2, late: 1, excused: 1, total_days: 22, attendance_percentage: 82 }, academic: { average_score: 87, total_assessments: 5 } } });
});

// Attendance routes
router.get('/attendance', (req, res) => {
  let filtered = [...mockAttendance];
  if (req.query.student_id) filtered = filtered.filter((a) => a.student_id === req.query.student_id);
  if (req.query.start_date) filtered = filtered.filter((a) => a.date >= req.query.start_date);
  if (req.query.end_date) filtered = filtered.filter((a) => a.date <= req.query.end_date);
  if (req.query.status) filtered = filtered.filter((a) => a.status === req.query.status);
  if (req.query.group_id) filtered = filtered.filter((a) => a.group_id === req.query.group_id);
  res.json({ success: true, data: filtered });
});
router.get('/attendance/summary', (req, res) => {
  res.json({ success: true, data: { total_sessions: 42, present_count: 35, absent_count: 3, late_count: 2, excused_count: 2, attendance_rate: 83 } });
});

// Grades routes
router.get('/grades', (req, res) => {
  let filtered = [...mockGrades];
  if (req.query.student_id) filtered = filtered.filter((g) => g.student_id === req.query.student_id);
  if (req.query.subject) filtered = filtered.filter((g) => g.subject === req.query.subject);
  if (req.query.assessment_type) filtered = filtered.filter((g) => g.assessment_type === req.query.assessment_type);
  if (req.query.start_date) filtered = filtered.filter((g) => g.date >= req.query.start_date);
  if (req.query.end_date) filtered = filtered.filter((g) => g.date <= req.query.end_date);
  res.json(paginate(filtered, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 50));
});
router.get('/grades/stats', (req, res) => {
  res.json({ success: true, data: { total_assessments: 15, average_score: 83, by_subject: { Mathematics: { count: 9, average: 87 }, Physics: { count: 4, average: 74 }, Arabic: { count: 2, average: 89 } }, by_assessment_type: { quiz: { count: 4, average: 79 }, midterm: { count: 4, average: 80 }, homework: { count: 2, average: 93 }, final: { count: 5, average: 88 } } } });
});

// Messages routes
router.get('/messages/conversations', (req, res) => {
  res.json(paginate(mockConversations, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 50));
});
router.get('/messages/conversations/:id', (req, res) => {
  const msgs = mockMessages.filter((m) => m.conversation_id === req.params.id);
  res.json(paginate(msgs, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 50));
});
router.get('/messages/stats', (req, res) => {
  res.json({ success: true, data: { total_messages: 156, incoming_messages: 89, outgoing_messages: 67, automated_messages: 45, manual_messages: 22, common_intents: { attendance: 32, grades: 28, schedule: 15, payment: 12, general: 2 } } });
});

// Offerings routes
router.get('/offerings', (req, res) => {
  res.json({ success: true, data: mockOfferings });
});

// Teachers routes
router.get('/teachers/dashboard', (req, res) => {
  res.json({ success: true, data: { total_students: 12, active_students: 8, total_parents: 10, recent_attendance: [{ date: daysAgo(0), present: 7, absent: 1, total: 8 }, { date: daysAgo(1), present: 6, absent: 1, total: 8 }, { date: daysAgo(2), present: 8, absent: 0, total: 8 }, { date: daysAgo(3), present: 5, absent: 2, total: 8 }, { date: daysAgo(4), present: 7, absent: 1, total: 8 }], recent_grades: [{ subject: 'Mathematics', average: 87, count: 9 }, { subject: 'Physics', average: 74, count: 4 }, { subject: 'Arabic', average: 89, count: 2 }], message_stats: { total_conversations: 5, unread_messages: 2, response_rate: 92 } } });
});
router.get('/teachers/settings', (req, res) => {
  res.json({ success: true, data: { id: 'cc0e8400-e29b-41d4-a716-446655440080', teacher_id: TEACHER_ID, auto_reply_enabled: true, auto_reply_message: 'شكراً لرسالتك، سأرد عليك في أقرب وقت', attendance_reminder_enabled: true, attendance_reminder_time: '08:00', grade_notification_enabled: true, preferred_language: 'ar', timezone: 'Africa/Cairo', created_at: '2024-09-01T00:00:00.000Z', updated_at: nowISO() } });
});
router.put('/teachers/settings', (req, res) => {
  res.json({ success: true, data: { id: 'cc0e8400-e29b-41d4-a716-446655440080', teacher_id: TEACHER_ID, ...req.body, preferred_language: req.body.preferred_language || 'ar', timezone: req.body.timezone || 'Africa/Cairo', created_at: '2024-09-01T00:00:00.000Z', updated_at: nowISO() } });
});

// Parents routes
router.get('/parents', (req, res) => {
  res.json({ success: true, data: mockStudents.filter((s) => s.parents?.length).flatMap((s) => s.parents.map((p) => ({ ...p, student_id: s.id, email: null, telegram_username: null, communication_preferences: null, created_at: s.created_at, updated_at: s.updated_at, student: { id: s.id, name: s.name, student_id: s.student_id } }))) });
});

// WhatsApp routes
router.get('/whatsapp/status', (req, res) => {
  res.json({ connected: false, status: 'disconnected', message: 'WhatsApp not connected', sessionExists: false });
});
router.get('/whatsapp/conversations', (req, res) => {
  res.json(paginate(mockConversations, parseInt(req.query.page) || 1, parseInt(req.query.limit) || 50));
});
router.post('/whatsapp/pair', (req, res) => {
  res.json({ success: true, message: 'Pairing started' });
});
router.post('/whatsapp/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});
router.post('/whatsapp/send-test', (req, res) => {
  res.json({ success: true, message: 'Message sent' });
});

module.exports = router;
