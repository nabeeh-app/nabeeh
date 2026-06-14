import type {
  Teacher,
  Student,
  Offering,
  Attendance,
  AttendanceSummary,
  Grade,
  GradeStats,
  Conversation,
  Message,
  MessageStats,
  DashboardStats,
  TeacherSettings,
  ParentProfile,
  StudentStats,
} from '@/types';

const TEACHER_ID = '550e8400-e29b-41d4-a716-446655440000';

const today = new Date();
const daysAgo = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};
const nowISO = () => new Date().toISOString();

export const mockTeacher: Teacher = {
  id: TEACHER_ID,
  email: 'ahmed.hassan@example.com',
  phone: '+201012345678',
  name: 'أحمد حسن',
  role: 'teacher',
  preferred_language: 'ar',
  business_name: 'أكاديمية النجاح',
  logo_url: null,
  bio: 'مدرس رياضيات وفيزياء للمرحلة الثانوية',
  subjects: ['Mathematics', 'Physics'],
  address: 'شارع金字塔، المعادي',
  city: 'القاهرة',
  country: 'مصر',
  timezone: 'Africa/Cairo',
  whatsapp_number: '+201012345678',
  telegram_username: '@ahmed_hassan',
  is_active: true,
  subscription_plan: 'pro',
  subscription_expires_at: '2027-01-01T00:00:00.000Z',
  created_at: '2024-09-01T00:00:00.000Z',
  updated_at: nowISO(),
};

const GROUP_A_ID = '660e8400-e29b-41d4-a716-446655440010';
const GROUP_B_ID = '660e8400-e29b-41d4-a716-446655440011';
const GROUP_C_ID = '660e8400-e29b-41d4-a716-446655440012';

export const mockOfferings: Offering[] = [
  {
    id: '770e8400-e29b-41d4-a716-446655440020',
    academic_year: '2025-2026',
    is_active: true,
    subject: { name_en: 'Mathematics', name_ar: 'الرياضيات', code: 'MATH' },
    grade_level: { name: '1st Secondary', order: 1 },
    groups: [
      { id: GROUP_A_ID, name: 'المجموعة أ', schedule_description: 'السبت والأحد 10:00-12:00' },
      { id: GROUP_B_ID, name: 'المجموعة ب', schedule_description: 'السبت والأحد 1:00-3:00' },
    ],
  },
  {
    id: '770e8400-e29b-41d4-a716-446655440021',
    academic_year: '2025-2026',
    is_active: true,
    subject: { name_en: 'Physics', name_ar: 'الفيزياء', code: 'PHYS' },
    grade_level: { name: '2nd Secondary', order: 2 },
    groups: [
      { id: GROUP_C_ID, name: 'المجموعة أ', schedule_description: 'الاثنين والأربعاء 4:00-6:00' },
    ],
  },
  {
    id: '770e8400-e29b-41d4-a716-446655440022',
    academic_year: '2025-2026',
    is_active: true,
    subject: { name_en: 'Arabic', name_ar: 'اللغة العربية', code: 'ARAB' },
    grade_level: { name: '3rd Secondary', order: 3 },
    groups: [
      { id: '660e8400-e29b-41d4-a716-446655440013', name: 'المجموعة أ', schedule_description: 'الثلاثاء والخميس 2:00-4:00' },
    ],
  },
];

const STUDENT_IDS = [
  '880e8400-e29b-41d4-a716-446655440030',
  '880e8400-e29b-41d4-a716-446655440031',
  '880e8400-e29b-41d4-a716-446655440032',
  '880e8400-e29b-41d4-a716-446655440033',
  '880e8400-e29b-41d4-a716-446655440034',
  '880e8400-e29b-41d4-a716-446655440035',
  '880e8400-e29b-41d4-a716-446655440036',
  '880e8400-e29b-41d4-a716-446655440037',
];

export const mockStudents: Student[] = [
  {
    id: STUDENT_IDS[0],
    teacher_id: TEACHER_ID,
    student_id: 'ST001',
    name: 'أحمد محمد علي',
    grade_level: '1st Secondary',
    group_id: GROUP_A_ID,
    date_of_birth: '2010-03-15',
    gender: 'male',
    subjects: ['Mathematics'],
    enrollment_date: daysAgo(60),
    status: 'active',
    notes: null,
    emergency_contact: '+201098765432',
    address: 'المعادي، القاهرة',
    created_at: daysAgo(60),
    updated_at: nowISO(),
    parents: [
      { id: 'aa0e8400-e29b-41d4-a716-446655440040', name: 'محمد علي', phone: '+201098765432', is_primary: true, relationship: 'father', preferred_language: 'ar' },
    ],
  },
  {
    id: STUDENT_IDS[1],
    teacher_id: TEACHER_ID,
    student_id: 'ST002',
    name: 'فاطمة أحمد',
    grade_level: '1st Secondary',
    group_id: GROUP_A_ID,
    date_of_birth: '2010-07-22',
    gender: 'female',
    subjects: ['Mathematics'],
    enrollment_date: daysAgo(55),
    status: 'active',
    notes: 'متفوقة في الامتحانات',
    emergency_contact: '+201087654321',
    address: 'الزمالك، القاهرة',
    created_at: daysAgo(55),
    updated_at: nowISO(),
    parents: [
      { id: 'aa0e8400-e29b-41d4-a716-446655440041', name: 'أحمد فاطمة', phone: '+201087654321', is_primary: true, relationship: 'father', preferred_language: 'ar' },
    ],
  },
  {
    id: STUDENT_IDS[2],
    teacher_id: TEACHER_ID,
    student_id: 'ST003',
    name: 'عمر حسن',
    grade_level: '1st Secondary',
    group_id: GROUP_B_ID,
    date_of_birth: '2010-01-10',
    gender: 'male',
    subjects: ['Mathematics'],
    enrollment_date: daysAgo(45),
    status: 'active',
    notes: null,
    emergency_contact: '+201076543210',
    address: 'مصر الجديدة، القاهرة',
    created_at: daysAgo(45),
    updated_at: nowISO(),
    parents: [
      { id: 'aa0e8400-e29b-41d4-a716-446655440042', name: 'حسن أحمد', phone: '+201076543210', is_primary: true, relationship: 'father', preferred_language: 'ar' },
    ],
  },
  {
    id: STUDENT_IDS[3],
    teacher_id: TEACHER_ID,
    student_id: 'ST004',
    name: 'نور محمد',
    grade_level: '1st Secondary',
    group_id: GROUP_B_ID,
    date_of_birth: '2010-11-05',
    gender: 'female',
    subjects: ['Mathematics'],
    enrollment_date: daysAgo(40),
    status: 'active',
    notes: null,
    emergency_contact: '+201065432109',
    address: 'الرحاب، القاهرة',
    created_at: daysAgo(40),
    updated_at: nowISO(),
    parents: [
      { id: 'aa0e8400-e29b-41d4-a716-446655440043', name: 'محمد نور', phone: '+201065432109', is_primary: true, relationship: 'father', preferred_language: 'en' },
    ],
  },
  {
    id: STUDENT_IDS[4],
    teacher_id: TEACHER_ID,
    student_id: 'ST005',
    name: 'يوسف إبراهيم',
    grade_level: '2nd Secondary',
    group_id: GROUP_C_ID,
    date_of_birth: '2009-05-18',
    gender: 'male',
    subjects: ['Physics'],
    enrollment_date: daysAgo(30),
    status: 'active',
    notes: null,
    emergency_contact: '+201054321098',
    address: 'التجمع الخامس، القاهرة',
    created_at: daysAgo(30),
    updated_at: nowISO(),
    parents: [
      { id: 'aa0e8400-e29b-41d4-a716-446655440044', name: 'إبراهيم يوسف', phone: '+201054321098', is_primary: true, relationship: 'father', preferred_language: 'ar' },
    ],
  },
  {
    id: STUDENT_IDS[5],
    teacher_id: TEACHER_ID,
    student_id: 'ST006',
    name: 'سارة خالد',
    grade_level: '2nd Secondary',
    group_id: GROUP_C_ID,
    date_of_birth: '2009-09-25',
    gender: 'female',
    subjects: ['Physics'],
    enrollment_date: daysAgo(25),
    status: 'active',
    notes: 'تحتاج متابعة إضافية',
    emergency_contact: '+201043210987',
    address: 'المهندسين، الجيزة',
    created_at: daysAgo(25),
    updated_at: nowISO(),
    parents: [
      { id: 'aa0e8400-e29b-41d4-a716-446655440045', name: 'خالد سارة', phone: '+201043210987', is_primary: true, relationship: 'father', preferred_language: 'ar' },
    ],
  },
  {
    id: STUDENT_IDS[6],
    teacher_id: TEACHER_ID,
    student_id: 'ST007',
    name: 'مريم حسين',
    grade_level: '3rd Secondary',
    group_id: '660e8400-e29b-41d4-a716-446655440013',
    date_of_birth: '2008-12-01',
    gender: 'female',
    subjects: ['Arabic'],
    enrollment_date: daysAgo(90),
    status: 'active',
    notes: null,
    emergency_contact: '+201032109876',
    address: 'حلوان، القاهرة',
    created_at: daysAgo(90),
    updated_at: nowISO(),
    parents: [
      { id: 'aa0e8400-e29b-41d4-a716-446655440046', name: 'حسين مريم', phone: '+201032109876', is_primary: true, relationship: 'father', preferred_language: 'ar' },
    ],
  },
  {
    id: STUDENT_IDS[7],
    teacher_id: TEACHER_ID,
    student_id: 'ST008',
    name: 'عثمان أحمد',
    grade_level: '1st Secondary',
    group_id: GROUP_A_ID,
    date_of_birth: '2010-06-30',
    gender: 'male',
    subjects: ['Mathematics'],
    enrollment_date: daysAgo(100),
    status: 'inactive',
    notes: 'انتقل إلى مدينة أخرى',
    emergency_contact: '+201021098765',
    address: 'الإسكندرية',
    created_at: daysAgo(100),
    updated_at: nowISO(),
    parents: [
      { id: 'aa0e8400-e29b-41d4-a716-446655440047', name: 'أحمد عثمان', phone: '+201021098765', is_primary: true, relationship: 'father', preferred_language: 'ar' },
    ],
  },
];

export const mockAttendance: Attendance[] = (() => {
  const records: Attendance[] = [];
  const statuses: Array<'present' | 'absent' | 'late' | 'excused'> = ['present', 'present', 'present', 'present', 'absent', 'late', 'present', 'excused'];
  const studentsForAttendance = mockStudents.filter((s) => s.status === 'active');
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    studentsForAttendance.forEach((student, i) => {
      records.push({
        id: `att-${dayOffset}-${i}`,
        student_id: student.id,
        teacher_id: TEACHER_ID,
        group_id: student.group_id || undefined,
        date: daysAgo(dayOffset),
        status: statuses[(i + dayOffset) % statuses.length],
        notes: null,
        created_at: daysAgo(dayOffset),
        updated_at: daysAgo(dayOffset),
        student,
      });
    });
  }
  return records;
})();

export const mockAttendanceSummary: AttendanceSummary = {
  total_sessions: 42,
  present_count: 35,
  absent_count: 3,
  late_count: 2,
  excused_count: 2,
  attendance_rate: 83,
};

const GRADE_IDS = [
  '990e8400-e29b-41d4-a716-446655440050',
  '990e8400-e29b-41d4-a716-446655440051',
  '990e8400-e29b-41d4-a716-446655440052',
  '990e8400-e29b-41d4-a716-446655440053',
  '990e8400-e29b-41d4-a716-446655440054',
  '990e8400-e29b-41d4-a716-446655440055',
  '990e8400-e29b-41d4-a716-446655440056',
  '990e8400-e29b-41d4-a716-446655440057',
  '990e8400-e29b-41d4-a716-446655440058',
  '990e8400-e29b-41d4-a716-446655440059',
  '990e8400-e29b-41d4-a716-446655440060',
  '990e8400-e29b-41d4-a716-446655440061',
  '990e8400-e29b-41d4-a716-446655440062',
  '990e8400-e29b-41d4-a716-446655440063',
  '990e8400-e29b-41d4-a716-446655440064',
];

const letterGrade = (pct: number) =>
  pct >= 90 ? 'A+' : pct >= 85 ? 'A' : pct >= 80 ? 'B+' : pct >= 75 ? 'B' : pct >= 70 ? 'C+' : pct >= 60 ? 'C' : 'D';

const gradeEntries = [
  { studentIdx: 0, subject: 'Mathematics', type: 'quiz', name: 'Quiz 1', scores: [85, 100], date: daysAgo(30) },
  { studentIdx: 1, subject: 'Mathematics', type: 'quiz', name: 'Quiz 1', scores: [92, 100], date: daysAgo(30) },
  { studentIdx: 2, subject: 'Mathematics', type: 'midterm', name: 'Midterm', scores: [78, 100], date: daysAgo(20) },
  { studentIdx: 3, subject: 'Mathematics', type: 'midterm', name: 'Midterm', scores: [88, 100], date: daysAgo(20) },
  { studentIdx: 0, subject: 'Mathematics', type: 'homework', name: 'HW 1', scores: [45, 50], date: daysAgo(15) },
  { studentIdx: 1, subject: 'Mathematics', type: 'homework', name: 'HW 1', scores: [48, 50], date: daysAgo(15) },
  { studentIdx: 4, subject: 'Physics', type: 'quiz', name: 'Quiz 1', scores: [72, 100], date: daysAgo(28) },
  { studentIdx: 5, subject: 'Physics', type: 'quiz', name: 'Quiz 1', scores: [65, 100], date: daysAgo(28) },
  { studentIdx: 4, subject: 'Physics', type: 'midterm', name: 'Midterm', scores: [81, 100], date: daysAgo(18) },
  { studentIdx: 5, subject: 'Physics', type: 'midterm', name: 'Midterm', scores: [74, 100], date: daysAgo(18) },
  { studentIdx: 6, subject: 'Arabic', type: 'quiz', name: 'Quiz 1', scores: [90, 100], date: daysAgo(25) },
  { studentIdx: 6, subject: 'Arabic', type: 'final', name: 'Final', scores: [88, 100], date: daysAgo(5) },
  { studentIdx: 0, subject: 'Mathematics', type: 'final', name: 'Final', scores: [91, 100], date: daysAgo(3) },
  { studentIdx: 1, subject: 'Mathematics', type: 'final', name: 'Final', scores: [95, 100], date: daysAgo(3) },
  { studentIdx: 4, subject: 'Physics', type: 'final', name: 'Final', scores: [79, 100], date: daysAgo(2) },
];

export const mockGrades: Grade[] = gradeEntries.map((g, i) => {
  const pct = Math.round((g.scores[0] / g.scores[1]) * 100);
  return {
    id: GRADE_IDS[i],
    student_id: STUDENT_IDS[g.studentIdx],
    teacher_id: TEACHER_ID,
    group_id: mockStudents[g.studentIdx].group_id || null,
    subject: g.subject,
    assessment_type: g.type,
    assessment_name: g.name,
    score: g.scores[0],
    max_score: g.scores[1],
    percentage: pct,
    letter_grade: letterGrade(pct),
    date: g.date,
    notes: null,
    created_at: g.date,
    updated_at: g.date,
    student: mockStudents[g.studentIdx],
  };
});

export const mockGradeStats: GradeStats = {
  total_assessments: 15,
  average_score: 83,
  by_subject: {
    Mathematics: { count: 9, average: 87 },
    Physics: { count: 4, average: 74 },
    Arabic: { count: 2, average: 89 },
  },
  by_assessment_type: {
    quiz: { count: 4, average: 79 },
    midterm: { count: 4, average: 80 },
    homework: { count: 2, average: 93 },
    final: { count: 5, average: 88 },
  },
};

const CONVERSATION_IDS = [
  'bb0e8400-e29b-41d4-a716-446655440070',
  'bb0e8400-e29b-41d4-a716-446655440071',
  'bb0e8400-e29b-41d4-a716-446655440072',
  'bb0e8400-e29b-41d4-a716-446655440073',
  'bb0e8400-e29b-41d4-a716-446655440074',
];

export const mockConversations: Conversation[] = [
  { id: CONVERSATION_IDS[0], teacher_id: TEACHER_ID, parent_phone: '+201098765432', parent_name: 'محمد علي', student_name: 'أحمد محمد علي', last_message_at: daysAgo(0), is_active: true, created_at: daysAgo(30), updated_at: daysAgo(0), message_count: 8, latest_message: 'شكراً جزيلاً' },
  { id: CONVERSATION_IDS[1], teacher_id: TEACHER_ID, parent_phone: '+201087654321', parent_name: 'أحمد فاطمة', student_name: 'فاطمة أحمد', last_message_at: daysAgo(1), is_active: true, created_at: daysAgo(25), updated_at: daysAgo(1), message_count: 5, latest_message: 'هل هناك واجبات إضافية؟' },
  { id: CONVERSATION_IDS[2], teacher_id: TEACHER_ID, parent_phone: '+201054321098', parent_name: 'إبراهيم يوسف', student_name: 'يوسف إبراهيم', last_message_at: daysAgo(1), is_active: true, created_at: daysAgo(15), updated_at: daysAgo(1), message_count: 3, latest_message: 'تمام، شكراً' },
  { id: CONVERSATION_IDS[3], teacher_id: TEACHER_ID, parent_phone: '+201043210987', parent_name: 'خالد سارة', student_name: 'سارة خالد', last_message_at: daysAgo(2), is_active: false, created_at: daysAgo(20), updated_at: daysAgo(2), message_count: 2, latest_message: 'حسناً' },
  { id: CONVERSATION_IDS[4], teacher_id: TEACHER_ID, parent_phone: '+201032109876', parent_name: 'حسين مريم', student_name: 'مريم حسين', last_message_at: daysAgo(3), is_active: true, created_at: daysAgo(10), updated_at: daysAgo(3), message_count: 4, latest_message: 'ما موعد الامتحان القادم؟' },
];

export const mockMessages: Message[] = [
  { id: 'msg-01', conversation_id: CONVERSATION_IDS[0], sender_phone: '+201098765432', sender_name: 'محمد علي', content: 'السلام عليكم، كيف حال أحمد في الفصل؟', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(5) },
  { id: 'msg-02', conversation_id: CONVERSATION_IDS[0], sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'وعليكم السلام، أحمد ممتاز و积极参与 في الحصص', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(5) },
  { id: 'msg-03', conversation_id: CONVERSATION_IDS[0], sender_phone: '+201098765432', sender_name: 'محمد علي', content: 'هل هناك أي مشاكل يجب أن أعرفها؟', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(4) },
  { id: 'msg-04', conversation_id: CONVERSATION_IDS[0], sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'لا، كل شيء على ما يرام. أحمد يحصل على درجات جيدة في الاختبارات الأخيرة.', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(4) },
  { id: 'msg-05', conversation_id: CONVERSATION_IDS[0], sender_phone: '+201098765432', sender_name: 'محمد علي', content: 'ممتاز، شكراً على المتابعة', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(3) },
  { id: 'msg-06', conversation_id: CONVERSATION_IDS[0], sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'العفو، لا تتردد في التواصل معي في أي وقت', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(3) },
  { id: 'msg-07', conversation_id: CONVERSATION_IDS[0], sender_phone: '+201098765432', sender_name: 'محمد علي', content: 'هل يمكنني الحصول على جدول الامتحانات القادمة؟', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(1) },
  { id: 'msg-08', conversation_id: CONVERSATION_IDS[0], sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'بالتأكيد، سأرسله لك الآن', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(1) },
  { id: 'msg-09', conversation_id: CONVERSATION_IDS[1], sender_phone: '+201087654321', sender_name: 'أحمد فاطمة', content: 'مرحباً، أريد أن أسأل عن تقدم فاطمة', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(3) },
  { id: 'msg-10', conversation_id: CONVERSATION_IDS[1], sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'فاطمة متفوقة، حصلت على أعلى درجة في اختبار الرياضيات الأخير', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(3) },
  { id: 'msg-11', conversation_id: CONVERSATION_IDS[1], sender_phone: '+201087654321', sender_name: 'أحمد فاطمة', content: 'الحمد لله، هل هناك واجبات إضافية يمكنها làmها؟', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(2) },
  { id: 'msg-12', conversation_id: CONVERSATION_IDS[1], sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'نعم، سأرسل لها مجموعات إضافية للتدريب', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(2) },
  { id: 'msg-13', conversation_id: CONVERSATION_IDS[1], sender_phone: '+201087654321', sender_name: 'أحمد فاطمة', content: 'هل هناك واجبات إضافية؟', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(1) },
  { id: 'msg-14', conversation_id: CONVERSATION_IDS[2], sender_phone: '+201054321098', sender_name: 'إبراهيم يوسف', content: 'مرحباً، يوسف يحتاج مساعدة في الفيزياء', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(5) },
  { id: 'msg-15', conversation_id: CONVERSATION_IDS[2], sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'سأراجع مع يوسف في الدرس القادم', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(5) },
  { id: 'msg-16', conversation_id: CONVERSATION_IDS[2], sender_phone: '+201054321098', sender_name: 'إبراهيم يوسف', content: 'تمام، شكراً', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(1) },
  { id: 'msg-17', conversation_id: CONVERSATION_IDS[3], sender_phone: '+201043210987', sender_name: 'خالد سارة', content: 'هل سارة قامت بدفع الرسوم؟', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(5) },
  { id: 'msg-18', conversation_id: CONVERSATION_IDS[3], sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'نعم، تم الدفع', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(5) },
  { id: 'msg-19', conversation_id: CONVERSATION_IDS[4], sender_phone: '+201032109876', sender_name: 'حسين مريم', content: 'ما موعد الامتحان القادم للغة العربية؟', message_type: 'text', is_from_parent: true, ai_response_confidence: null, created_at: daysAgo(4) },
  { id: 'msg-20', conversation_id: CONVERSATION_IDS[4], sender_phone: '+201012345678', sender_name: 'أحمد حسن', content: 'الامتحان يوم السبت القادم إن شاء الله', message_type: 'text', is_from_parent: false, ai_response_confidence: null, created_at: daysAgo(4) },
];

export const mockMessageStats: MessageStats = {
  total_messages: 156,
  incoming_messages: 89,
  outgoing_messages: 67,
  automated_messages: 45,
  manual_messages: 22,
  common_intents: {
    attendance: 32,
    grades: 28,
    schedule: 15,
    payment: 12,
    general: 2,
  },
};

export const mockDashboardStats: DashboardStats = {
  total_students: 12,
  active_students: 8,
  total_parents: 10,
  recent_attendance: [
    { date: daysAgo(0), present: 7, absent: 1, total: 8 },
    { date: daysAgo(1), present: 6, absent: 1, total: 8 },
    { date: daysAgo(2), present: 8, absent: 0, total: 8 },
    { date: daysAgo(3), present: 5, absent: 2, total: 8 },
    { date: daysAgo(4), present: 7, absent: 1, total: 8 },
  ],
  recent_grades: [
    { subject: 'Mathematics', average: 87, count: 9 },
    { subject: 'Physics', average: 74, count: 4 },
    { subject: 'Arabic', average: 89, count: 2 },
  ],
  message_stats: {
    total_conversations: 5,
    unread_messages: 2,
    response_rate: 92,
  },
};

export const mockSettings: TeacherSettings = {
  id: 'cc0e8400-e29b-41d4-a716-446655440080',
  teacher_id: TEACHER_ID,
  auto_reply_enabled: true,
  auto_reply_message: 'شكراً لرسالتك، سأرد عليك في أقرب وقت',
  attendance_reminder_enabled: true,
  attendance_reminder_time: '08:00',
  grade_notification_enabled: true,
  preferred_language: 'ar',
  timezone: 'Africa/Cairo',
  created_at: '2024-09-01T00:00:00.000Z',
  updated_at: nowISO(),
};

export const mockStudentStats: StudentStats = {
  attendance: {
    present: 18,
    absent: 2,
    late: 1,
    excused: 1,
    total_days: 22,
    attendance_percentage: 82,
  },
  academic: {
    average_score: 87,
    total_assessments: 5,
  },
};

export const mockParents: ParentProfile[] = [
  {
    id: 'aa0e8400-e29b-41d4-a716-446655440040',
    name: 'محمد علي',
    phone: '+201098765432',
    is_primary: true,
    relationship: 'father',
    preferred_language: 'ar',
    student_id: STUDENT_IDS[0],
    email: null,
    telegram_username: null,
    communication_preferences: null,
    created_at: daysAgo(60),
    updated_at: nowISO(),
    student: { id: STUDENT_IDS[0], name: 'أحمد محمد علي', student_id: 'ST001' },
  },
  {
    id: 'aa0e8400-e29b-41d4-a716-446655440041',
    name: 'أحمد فاطمة',
    phone: '+201087654321',
    is_primary: true,
    relationship: 'father',
    preferred_language: 'ar',
    student_id: STUDENT_IDS[1],
    email: null,
    telegram_username: null,
    communication_preferences: null,
    created_at: daysAgo(55),
    updated_at: nowISO(),
    student: { id: STUDENT_IDS[1], name: 'فاطمة أحمد', student_id: 'ST002' },
  },
  {
    id: 'aa0e8400-e29b-41d4-a716-446655440042',
    name: 'حسن أحمد',
    phone: '+201076543210',
    is_primary: true,
    relationship: 'father',
    preferred_language: 'ar',
    student_id: STUDENT_IDS[2],
    email: null,
    telegram_username: null,
    communication_preferences: null,
    created_at: daysAgo(45),
    updated_at: nowISO(),
    student: { id: STUDENT_IDS[2], name: 'عمر حسن', student_id: 'ST003' },
  },
];
