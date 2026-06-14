// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number | null;
    pages: number;
  };
}

// Authentication Types
export interface Teacher {
  id: string;
  email: string;
  phone: string;
  name: string;
  role: 'teacher' | 'admin' | 'parent' | 'assistant';
  teacherId?: string;
  preferred_language: string;
  business_name: string | null;
  logo_url: string | null;
  bio: string | null;
  subjects: string[] | null;
  address: string | null;
  city: string | null;
  country: string | null;
  timezone: string | null;
  whatsapp_number: string | null;
  telegram_username: string | null;
  is_active: boolean;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  settings?: {
    notification_preferences?: Record<string, boolean>;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  teacher: Teacher;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  phone: string;
  password: string;
  business_name?: string;
  subjects?: string[];
  whatsapp_number?: string;
}

// Student Types
export interface Parent {
  id: string;
  name: string;
  phone: string;
  is_primary: boolean;
  relationship: string;
  preferred_language: string;
}

export interface Student {
  id: string;
  teacher_id: string;
  student_id: string;
  name: string;
  grade_level: string;
  group_id?: string | null;
  date_of_birth: string | null;
  gender: string | null;
  subjects: string[] | null;
  enrollment_date: string;
  status: 'active' | 'inactive' | 'graduated';
  notes: string | null;
  emergency_contact: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
  parents?: Parent[];
}

export interface CreateStudentRequest {
  student_id: string;
  name: string;
  grade_level: string;
  group_id: string;
  date_of_birth?: string;
  gender?: string;
  subjects?: string[];
  enrollment_date: string;
  status?: 'active' | 'inactive' | 'graduated';
  notes?: string;
  emergency_contact?: string;
  address?: string;
}

// Attendance Types
export interface Attendance {
  id: string;
  student_id: string;
  teacher_id: string;
  group_id?: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes: string | null;
  created_at: string;
  updated_at: string;
  student?: Student;
}

export interface CreateAttendanceRequest {
  student_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
}

export interface BulkAttendanceRequest {
  date: string;
  attendance: Array<{
    student_id: string;
    group_id: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    notes?: string;
    date?: string;
  }>;
}

// Grade Types
export interface Grade {
  id: string;
  student_id: string;
  teacher_id: string;
  group_id?: string | null;
  subject: string;
  assessment_type: string;
  assessment_name: string;
  score: number;
  max_score: number;
  percentage: number;
  letter_grade: string | null;
  date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  student?: Student;
}

export interface CreateGradeRequest {
  student_id: string;
  group_id: string;
  subject: string;
  assessment_type: string;
  assessment_name: string;
  score: number;
  max_score: number;
  date: string;
  notes?: string;
}

export interface BulkGradeRequest {
  grades: CreateGradeRequest[];
}

export interface GradeStats {
  total_assessments: number;
  average_score: number;
  by_subject: Record<string, { count: number; average: number }>;
  by_assessment_type: Record<string, { count: number; average: number }>;
}

// Message Types
export interface Message {
  id: string;
  conversation_id: string;
  sender_phone: string;
  sender_name: string;
  content: string;
  message_type: 'text' | 'image' | 'document' | 'voice';
  is_from_parent: boolean;
  ai_response_confidence: number | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  teacher_id: string;
  parent_phone: string;
  parent_name: string;
  student_name: string | null;
  last_message_at: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  message_count?: number;
  latest_message?: string;
}

export interface MessageStats {
  total_messages: number;
  incoming_messages: number;
  outgoing_messages: number;
  automated_messages: number;
  manual_messages: number;
  common_intents: Record<string, number>;
}

// Dashboard Types
export interface DashboardStats {
  total_students: number;
  active_students: number;
  total_parents: number;
  recent_attendance: {
    date: string;
    present: number;
    absent: number;
    total: number;
  }[];
  recent_grades: {
    subject: string;
    average: number;
    count: number;
  }[];
  message_stats: {
    total_conversations: number;
    unread_messages: number;
    response_rate: number;
  };
}

// Offerings Types
export interface OfferingSubject {
  name_en: string;
  name_ar: string;
  code: string;
}

export interface OfferingGradeLevel {
  name: string;
  order: number;
}

export interface OfferingGroup {
  id: string;
  name: string;
  schedule_description: string | null;
}

export interface Offering {
  id: string;
  academic_year: string | null;
  is_active: boolean;
  subject: OfferingSubject;
  grade_level: OfferingGradeLevel;
  groups: OfferingGroup[];
}

export interface CreateGroupRequest {
  name: string;
  schedule_description?: string | null;
}

// Student Stats Types
export interface StudentAttendanceStats {
  present: number;
  absent: number;
  late: number;
  excused: number;
  total_days: number;
  attendance_percentage: number;
}

export interface StudentAcademicStats {
  average_score: number;
  total_assessments: number;
}

export interface StudentStats {
  attendance: StudentAttendanceStats;
  academic: StudentAcademicStats;
}

// Attendance Summary Types
export interface AttendanceSummary {
  total_sessions: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  attendance_rate: number;
}

// Parents Types
export interface ParentStudentSummary {
  id: string;
  name: string;
  student_id: string;
}

export interface ParentProfile extends Parent {
  student_id: string;
  email: string | null;
  telegram_username: string | null;
  communication_preferences: unknown;
  created_at: string;
  updated_at: string;
  student?: ParentStudentSummary;
}

export interface CreateParentRequest {
  student_id: string;
  name: string;
  phone: string;
  email?: string | null;
  relationship: string;
  is_primary?: boolean;
  preferred_language?: string;
  telegram_username?: string | null;
  communication_preferences?: unknown;
}

export interface UpdateParentRequest {
  name?: string;
  phone?: string;
  email?: string | null;
  relationship?: string;
  is_primary?: boolean;
  preferred_language?: string;
  telegram_username?: string | null;
  communication_preferences?: unknown;
}

// Assistant Types
export interface Assistant {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'pending' | 'removed';
  permissions: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface AssistantInvite {
  id: string;
  email: string;
  permissions: Record<string, boolean>;
  status: string;
  created_at: string;
  expires_at: string;
}

// Notification Types
export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  created_at: string;
}

// Alert Types
export interface AlertRule {
  id: string;
  alert_type: 'attendance_threshold' | 'grade_threshold' | 'trend_anomaly';
  threshold_value: number;
  comparison: 'gt' | 'lt' | 'gte' | 'lte';
  notification_method: 'in_app' | 'whatsapp' | 'both';
  is_enabled: boolean;
  created_at: string;
}

export interface Alert {
  id: string;
  alert_type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  is_read: boolean;
  student_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Report Draft Types
export interface ReportDraft {
  id: string;
  student_id: string;
  group_id: string | null;
  draft_text: string;
  data_sources: Record<string, unknown> | null;
  status: 'pending' | 'approved' | 'edited' | 'rejected' | 'sent';
  edited_text: string | null;
  sent_at: string | null;
  created_at: string;
  student?: { name: string };
}

// Weekly Digest Types
export interface WeeklyDigest {
  id: string;
  week_start: string;
  week_end: string;
  digest_data: {
    improved: Array<{ student_name: string; metric: string; detail: string }>;
    declining: Array<{ student_name: string; metric: string; detail: string }>;
    action_items: string[];
  };
  created_at: string;
}

// Grade Analysis Types
export interface GroupComparison {
  group_id: string;
  group_name: string;
  average_score: number;
  student_count: number;
}

export interface AtRiskStudent {
  student_id: string;
  student_name: string;
  average_grade: number;
  attendance_rate: number;
  severity: 'warning' | 'critical';
}

export interface GradeDistribution {
  range: string;
  count: number;
}

export interface GradeTrend {
  assessment_name: string;
  score: number;
  date: string;
}

export interface GradeOverview {
  total_students: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  total_assessments: number;
}

// Notification Preferences
export interface NotificationPreferences {
  attendance_marked: boolean;
  grade_entered: boolean;
  whatsapp_sent: boolean;
  assistant_action: boolean;
  digest: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

// Settings Types
export interface TeacherSettings {
  id: string;
  teacher_id: string;
  auto_reply_enabled: boolean;
  auto_reply_message: string | null;
  attendance_reminder_enabled: boolean;
  attendance_reminder_time: string | null;
  grade_notification_enabled: boolean;
  preferred_language: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateSettingsRequest {
  auto_reply_enabled?: boolean;
  auto_reply_message?: string;
  attendance_reminder_enabled?: boolean;
  attendance_reminder_time?: string;
  grade_notification_enabled?: boolean;
  preferred_language?: string;
  timezone?: string;
}
