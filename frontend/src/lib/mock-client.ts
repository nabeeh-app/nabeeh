import { ApiClient } from './api';
import {
  mockTeacher,
  mockStudents,
  mockOfferings,
  mockAttendance,
  mockAttendanceSummary,
  mockGrades,
  mockGradeStats,
  mockConversations,
  mockMessages,
  mockMessageStats,
  mockDashboardStats,
  mockSettings,
  mockStudentStats,
  mockParents,
} from './mock-data';
import type {
  PaginatedResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  Teacher,
  Student,
  CreateStudentRequest,
  Attendance,
  BulkAttendanceRequest,
  AttendanceSummary,
  Grade,
  CreateGradeRequest,
  BulkGradeRequest,
  GradeStats,
  Conversation,
  Message,
  MessageStats,
  DashboardStats,
  TeacherSettings,
  UpdateSettingsRequest,
  Offering,
  OfferingGroup,
  CreateGroupRequest,
  ParentProfile,
  CreateParentRequest,
  UpdateParentRequest,
  StudentStats,
} from '@/types';

function paginate<T>(data: T[], page = 1, limit = 50): PaginatedResponse<T> {
  const total = data.length;
  const pages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  return {
    success: true,
    data: data.slice(start, start + limit),
    pagination: { page, limit, total, pages },
  };
}

const delay = (ms = 100) => new Promise((r) => setTimeout(r, ms));

class MockApiClient extends ApiClient {
  async login(_data: LoginRequest): Promise<AuthResponse> {
    await delay();
    const token = 'mock-jwt-token-' + Date.now();
    return { teacher: mockTeacher, token };
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    await delay();
    const token = 'mock-jwt-token-' + Date.now();
    return { teacher: { ...mockTeacher, name: data.name, email: data.email }, token };
  }

  async getMe(): Promise<Teacher> {
    await delay();
    return mockTeacher;
  }

  async updateProfile(data: Partial<Teacher>): Promise<Teacher> {
    await delay();
    return { ...mockTeacher, ...data };
  }

  async getStudents(params?: {
    page?: number;
    limit?: number;
    search?: string;
    grade_level?: string;
    status?: string;
    group_id?: string;
  }): Promise<PaginatedResponse<Student>> {
    await delay();
    let filtered = [...mockStudents];
    if (params?.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter((s) => s.name.toLowerCase().includes(q) || s.student_id.toLowerCase().includes(q));
    }
    if (params?.grade_level) {
      filtered = filtered.filter((s) => s.grade_level === params.grade_level);
    }
    if (params?.status) {
      filtered = filtered.filter((s) => s.status === params.status);
    }
    if (params?.group_id) {
      filtered = filtered.filter((s) => s.group_id === params.group_id);
    }
    return paginate(filtered, params?.page, params?.limit);
  }

  async getStudent(id: string): Promise<Student> {
    await delay();
    const student = mockStudents.find((s) => s.id === id);
    if (!student) throw new Error('Student not found');
    return student;
  }

  async createStudent(data: CreateStudentRequest): Promise<Student> {
    await delay();
    const newStudent: Student = {
      id: 'new-' + Date.now(),
      teacher_id: '550e8400-e29b-41d4-a716-446655440000',
      student_id: data.student_id,
      name: data.name,
      grade_level: data.grade_level,
      group_id: data.group_id,
      date_of_birth: data.date_of_birth || null,
      gender: data.gender || null,
      subjects: data.subjects || null,
      enrollment_date: data.enrollment_date,
      status: data.status || 'active',
      notes: data.notes || null,
      emergency_contact: data.emergency_contact || null,
      address: data.address || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockStudents.push(newStudent);
    return newStudent;
  }

  async updateStudent(id: string, data: Partial<CreateStudentRequest>): Promise<Student> {
    await delay();
    const idx = mockStudents.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Student not found');
    Object.assign(mockStudents[idx], data, { updated_at: new Date().toISOString() });
    return mockStudents[idx];
  }

  async deleteStudent(id: string): Promise<void> {
    await delay();
    const idx = mockStudents.findIndex((s) => s.id === id);
    if (idx !== -1) mockStudents.splice(idx, 1);
  }

  async getStudentStats(_id: string): Promise<StudentStats> {
    await delay();
    return mockStudentStats;
  }

  async getAttendance(params?: {
    page?: number;
    limit?: number;
    student_id?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    group_id?: string;
  }): Promise<Attendance[]> {
    await delay();
    let filtered = [...mockAttendance];
    if (params?.student_id) {
      filtered = filtered.filter((a) => a.student_id === params.student_id);
    }
    if (params?.start_date) {
      filtered = filtered.filter((a) => a.date >= params.start_date!);
    }
    if (params?.end_date) {
      filtered = filtered.filter((a) => a.date <= params.end_date!);
    }
    if (params?.status) {
      filtered = filtered.filter((a) => a.status === params.status);
    }
    if (params?.group_id) {
      filtered = filtered.filter((a) => a.group_id === params.group_id);
    }
    return filtered;
  }

  async createAttendance(data: BulkAttendanceRequest): Promise<Attendance[]> {
    await delay();
    return data.attendance.map((record, i) => ({
      id: 'new-att-' + Date.now() + '-' + i,
      student_id: record.student_id,
      teacher_id: '550e8400-e29b-41d4-a716-446655440000',
      group_id: record.group_id,
      date: record.date || data.date,
      status: record.status,
      notes: record.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));
  }

  async getAttendanceSummary(_params?: {
    start_date?: string;
    end_date?: string;
    student_id?: string;
    group_id?: string;
  }): Promise<AttendanceSummary> {
    await delay();
    return mockAttendanceSummary;
  }

  async getGrades(params?: {
    page?: number;
    limit?: number;
    student_id?: string;
    group_id?: string;
    subject?: string;
    assessment_type?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<PaginatedResponse<Grade>> {
    await delay();
    let filtered = [...mockGrades];
    if (params?.student_id) {
      filtered = filtered.filter((g) => g.student_id === params.student_id);
    }
    if (params?.subject) {
      filtered = filtered.filter((g) => g.subject === params.subject);
    }
    if (params?.assessment_type) {
      filtered = filtered.filter((g) => g.assessment_type === params.assessment_type);
    }
    if (params?.start_date) {
      filtered = filtered.filter((g) => g.date >= params.start_date!);
    }
    if (params?.end_date) {
      filtered = filtered.filter((g) => g.date <= params.end_date!);
    }
    return paginate(filtered, params?.page, params?.limit);
  }

  async createGrade(data: CreateGradeRequest): Promise<Grade> {
    await delay();
    const pct = Math.round((data.score / data.max_score) * 100);
    const letter = pct >= 90 ? 'A+' : pct >= 85 ? 'A' : pct >= 80 ? 'B+' : pct >= 75 ? 'B' : pct >= 70 ? 'C+' : pct >= 60 ? 'C' : 'D';
    const newGrade: Grade = {
      id: 'new-grade-' + Date.now(),
      student_id: data.student_id,
      teacher_id: '550e8400-e29b-41d4-a716-446655440000',
      group_id: data.group_id,
      subject: data.subject,
      assessment_type: data.assessment_type,
      assessment_name: data.assessment_name,
      score: data.score,
      max_score: data.max_score,
      percentage: pct,
      letter_grade: letter,
      date: data.date,
      notes: data.notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockGrades.push(newGrade);
    return newGrade;
  }

  async createBulkGrades(data: BulkGradeRequest): Promise<Grade[]> {
    await delay();
    const results: Grade[] = [];
    for (const g of data.grades) {
      const grade = await this.createGrade(g);
      results.push(grade);
    }
    return results;
  }

  async updateGrade(id: string, data: Partial<CreateGradeRequest>): Promise<Grade> {
    await delay();
    const idx = mockGrades.findIndex((g) => g.id === id);
    if (idx === -1) throw new Error('Grade not found');
    Object.assign(mockGrades[idx], data, { updated_at: new Date().toISOString() });
    return mockGrades[idx];
  }

  async deleteGrade(id: string): Promise<void> {
    await delay();
    const idx = mockGrades.findIndex((g) => g.id === id);
    if (idx !== -1) mockGrades.splice(idx, 1);
  }

  async getGradeStats(): Promise<GradeStats> {
    await delay();
    return mockGradeStats;
  }

  async getConversations(params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Conversation>> {
    await delay();
    return paginate(mockConversations, params?.page, params?.limit);
  }

  async getConversationMessages(id: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Message>> {
    await delay();
    const msgs = mockMessages.filter((m) => m.conversation_id === id);
    return paginate(msgs, params?.page, params?.limit);
  }

  async sendMessage(_data: { phone: string; message: string }): Promise<void> {
    await delay();
  }

  async startWhatsAppPairing(): Promise<void> {
    await delay();
  }

  async createTeacherAccount(data: {
    name: string;
    email: string;
    password: string;
    role?: 'teacher' | 'admin';
    preferred_language?: string;
  }): Promise<Teacher> {
    await delay();
    return { ...mockTeacher, name: data.name, email: data.email, role: data.role || 'teacher' };
  }

  async getMessageStats(): Promise<MessageStats> {
    await delay();
    return mockMessageStats;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    await delay();
    return mockDashboardStats;
  }

  async getOfferings(): Promise<Offering[]> {
    await delay();
    return mockOfferings;
  }

  async createGroup(_offeringId: string, data: CreateGroupRequest): Promise<OfferingGroup> {
    await delay();
    return { id: 'new-group-' + Date.now(), name: data.name, schedule_description: data.schedule_description || null };
  }

  async getSettings(): Promise<TeacherSettings> {
    await delay();
    return mockSettings;
  }

  async updateSettings(data: UpdateSettingsRequest): Promise<TeacherSettings> {
    await delay();
    return { ...mockSettings, ...data };
  }

  async getParents(_params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ParentProfile[]> {
    await delay();
    return mockParents;
  }

  async createParent(data: CreateParentRequest): Promise<ParentProfile> {
    await delay();
    return {
      id: 'new-parent-' + Date.now(),
      name: data.name,
      phone: data.phone,
      is_primary: data.is_primary ?? true,
      relationship: data.relationship,
      preferred_language: data.preferred_language || 'ar',
      student_id: data.student_id,
      email: data.email || null,
      telegram_username: data.telegram_username || null,
      communication_preferences: data.communication_preferences || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async updateParent(id: string, data: UpdateParentRequest): Promise<ParentProfile> {
    await delay();
    const existing = mockParents.find((p) => p.id === id);
    if (!existing) throw new Error('Parent not found');
    return { ...existing, ...data, updated_at: new Date().toISOString() };
  }

  async deleteParent(_id: string): Promise<void> {
    await delay();
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  // Mock — Import/Export
  async previewImport(_file: File): Promise<any> { await delay(); return { fileName: 'mock.csv', totalRows: 0, headers: [], autoMapping: {}, unmappedColumns: [], preview: [] }; }
  async validateImport(_file: File, _mapping: Record<string, string>, _requiredFields?: string[]): Promise<any> { await delay(); return { fieldMapping: {}, rows: [], stats: { total: 0, ready: 0, warning: 0, error: 0 } }; }
  async executeImport(_data: { fieldMapping: Record<string, string>; rows: { data: Record<string, string>; status: string }[]; groupId: string; skipErrors?: boolean }): Promise<any> { await delay(); return { imported: 0, skipped: 0, errors: [] }; }
  async parsePastedData(_text: string): Promise<any> { await delay(); return { headers: [], autoMapping: {}, unmappedColumns: [], totalRows: 0, preview: [], allRows: [] }; }

  // Mock — Self-registration
  async generateRegistrationLink(_groupId: string, _expiresInHours?: number): Promise<any> { await delay(); return { url: 'https://nabeeh.app/register/xyz', token: 'mock-token', expiresAt: new Date().toISOString(), groupName: 'Group A', subject: 'Math' }; }
  async getRegistrationForm(_token: string): Promise<any> { await delay(); return { groupName: 'Group A', teacherName: 'Ahmed', fields: ['name', 'phone'] }; }
  async submitRegistration(_token: string, _data: { name: string; phone?: string; parent_phone?: string }): Promise<any> { await delay(); return { studentId: 'new-student', studentCode: 'ST999' }; }

  // Mock — Demo data
  async seedDemoData(): Promise<any> { await delay(); return { success: true, message: 'Demo data seeded' }; }
  async removeDemoData(): Promise<any> { await delay(); return { success: true, message: 'Demo data removed' }; }

  // Mock — WhatsApp
  async requestWhatsAppPairingCode(_phone: string): Promise<any> { await delay(); return { code: '123456', phone: _phone }; }
  async getWhatsAppStatus(): Promise<any> { await delay(); return { status: 'disconnected', qr: null, phone: null, pairingCodeMode: false }; }
  async logoutWhatsApp(): Promise<void> { await delay(); }

  // Mock — Offerings & Groups
  async getOffering(_id: string): Promise<any> { await delay(); return mockOfferings[0]; }
  async deleteOffering(_id: string): Promise<void> { await delay(); }
  async updateGroup(_offeringId: string, _groupId: string, _data: any): Promise<any> { await delay(); return { id: _groupId, name: _data?.name || 'Updated Group', schedule_description: _data?.schedule_description || null }; }
  async enrollStudent(_offeringId: string, _groupId: string, _studentId: string): Promise<void> { await delay(); }
  async unenrollStudent(_offeringId: string, _groupId: string, _studentId: string): Promise<void> { await delay(); }

  // Mock — Assistants
  async getAssistants(): Promise<any> { await delay(); return []; }
  async inviteAssistant(_email: string, _permissions?: Record<string, boolean>): Promise<any> { await delay(); return { id: 'invite-1', email: _email, expires_at: new Date().toISOString() }; }
  async inviteAssistantDual(_params: { email?: string; phone?: string; deliveryMethod: string; permissions?: Record<string, boolean> }): Promise<any> { await delay(); return { id: 'invite-2', email: _params.email || '', phone: _params.phone || '', expires_at: new Date().toISOString() }; }
  async getInviteByToken(_token: string): Promise<any> { await delay(); return { id: 'invite-1', teacherName: 'Ahmed', permissions: {}, expires_at: new Date().toISOString() }; }
  async acceptInvite(_token: string): Promise<any> { await delay(); return { assistantId: 'assistant-1' }; }
  async listPendingInvites(): Promise<any> { await delay(); return []; }
  async updateAssistantPermissions(_id: string, _permissions: Record<string, boolean>): Promise<any> { await delay(); return { id: _id, permissions: _permissions }; }
  async updateAssistantStatus(_id: string, _status: string): Promise<any> { await delay(); return { id: _id, status: _status }; }
  async removeAssistant(_id: string): Promise<void> { await delay(); }

  // Mock — Reports
  async generateReportComment(_studentId: string, _groupId?: string): Promise<any> { await delay(); return { id: 'draft-1', draft_text: 'Good progress', status: 'pending', created_at: new Date().toISOString() }; }
  async getReportDrafts(_params?: { page?: number; limit?: number; status?: string }): Promise<any> { await delay(); return { success: true, data: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } }; }
  async updateReportDraft(_id: string, _data: { edited_text?: string; status?: string }): Promise<any> { await delay(); return { id: _id, status: _data.status || 'edited' }; }
  async approveReportDraft(_id: string): Promise<any> { await delay(); return { id: _id, status: 'approved' }; }
  async rejectReportDraft(_id: string): Promise<any> { await delay(); return { id: _id, status: 'rejected' }; }
  async bulkGenerateComments(_groupId: string): Promise<any> { await delay(); return { job_id: 'job-1', status: 'completed' }; }
  async getJobStatus(_jobId: string): Promise<any> { await delay(); return { id: _jobId, status: 'completed', result: null, error: null }; }
  async getLatestDigest(): Promise<any> { await delay(); return { id: 'digest-1', week_start: '', week_end: '', digest_data: { improved: [], declining: [], action_items: [] }, created_at: new Date().toISOString() }; }
  async getDigestByWeek(_week: string): Promise<any> { await delay(); return { id: 'digest-1', week_start: _week, week_end: '', digest_data: {}, created_at: new Date().toISOString() }; }

  // Mock — Notifications
  async getNotifications(_params?: { page?: number; limit?: number; type?: string; unread_only?: boolean }): Promise<any> { await delay(); return { success: true, data: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } }; }
  async getUnreadNotificationCount(): Promise<any> { await delay(); return { count: 0 }; }
  async markNotificationRead(_id: string): Promise<void> { await delay(); }
  async markAllNotificationsRead(): Promise<void> { await delay(); }
  async deleteNotification(_id: string): Promise<void> { await delay(); }

  // Mock — Alerts
  async getAlertRules(): Promise<any> { await delay(); return []; }
  async createAlertRule(_data: { alert_type: string; threshold_value: number; comparison: string; notification_method?: string }): Promise<any> { await delay(); return { id: 'rule-1', alert_type: _data.alert_type }; }
  async updateAlertRule(_id: string, _data: any): Promise<any> { await delay(); return { id: _id }; }
  async deleteAlertRule(_id: string): Promise<void> { await delay(); }
  async toggleAlertRule(_id: string): Promise<any> { await delay(); return { id: _id, is_enabled: false }; }
  async getAlerts(_params?: { page?: number; limit?: number; severity?: string; alert_type?: string }): Promise<any> { await delay(); return { success: true, data: [], pagination: { page: 1, limit: 50, total: 0, pages: 0 } }; }
  async markAlertRead(_id: string): Promise<void> { await delay(); }
  async markAllAlertsRead(): Promise<void> { await delay(); }

  // Mock — Grade Analysis
  async getGroupComparison(_offeringId: string): Promise<any> { await delay(); return []; }
  async getAtRiskStudents(_offeringId: string, _params?: { grade_threshold?: number; attendance_threshold?: number }): Promise<any> { await delay(); return []; }
  async getGradeDistribution(_assessmentId: string): Promise<any> { await delay(); return []; }
  async getGradeTrends(_studentId: string): Promise<any> { await delay(); return []; }
  async getGradeOverview(_offeringId: string): Promise<any> { await delay(); return { total_students: 0, average: 0, highest: 0, lowest: 0, total_grades: 0 }; }

  // Mock — Other
  async updateNotificationPreferences(_data: { attendance_marked?: boolean; grade_entered?: boolean; whatsapp_sent?: boolean; assistant_action?: boolean; digest?: boolean; quiet_hours_start?: string; quiet_hours_end?: string }): Promise<any> { await delay(); return { id: 'prefs-1' }; }
  async requestPasswordReset(_email: string): Promise<any> { await delay(); return { message: 'Reset email sent', messageAr: 'تم إرسال بريد إعادة التعيين' }; }
  async resetPassword(_token: string, _newPassword: string): Promise<any> { await delay(); return { message: 'Password reset', messageAr: 'تم إعادة تعيين كلمة المرور' }; }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export default MockApiClient;
