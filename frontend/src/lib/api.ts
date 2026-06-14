import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  ApiResponse,
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
  StudentStats
} from '@/types';

class ApiClient {
  public api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api',
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout to prevent long waits
    });

    // Add request interceptor to include auth token
    this.api.interceptors.request.use((config) => {
      const token = this.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Add response interceptor for error handling with retry
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;
        
        // Only auto-logout on 401 (Unauthorized) errors, not on network timeouts or other errors
        if (error.response?.status === 401) {
          this.removeToken();
          const locale = window.location.pathname.split('/')[1] || 'en';
          window.location.href = `/${locale}/login`;
        }
        
        // Retry logic for 5xx errors and network errors
        if (!config || config.__retryCount) {
          return Promise.reject(error);
        }
        
        const status = error.response?.status;
        const isNetworkError = !error.response && error.code === 'ERR_NETWORK';
        const isRetryable = (status >= 500 && status < 600) || isNetworkError;
        
        if (!isRetryable) {
          return Promise.reject(error);
        }
        
        config.__retryCount = config.__retryCount || 0;
        const maxRetries = 3;
        
        if (config.__retryCount >= maxRetries) {
          return Promise.reject(error);
        }
        
        config.__retryCount += 1;
        
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, config.__retryCount - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.api(config);
      }
    );
  }

  // Token management
  // Fires a custom event on token change so AuthProvider can react without polling.
  // Pattern: Auth0, Clerk, Supabase — custom event + storage event for cross-tab sync.

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nabeeh_token');
    }
    return null;
  }

  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nabeeh_token', token);
      window.dispatchEvent(new CustomEvent('auth:token-changed', { detail: { token, action: 'set' } }));
    }
  }

  removeToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nabeeh_token');
      window.dispatchEvent(new CustomEvent('auth:token-changed', { detail: { token: null, action: 'remove' } }));
    }
  }

  // Authentication API
  async login(data: LoginRequest): Promise<AuthResponse> {
    const response: AxiosResponse<ApiResponse<AuthResponse>> = await this.api.post('/auth/login', data);
    if (response.data.success && response.data.data) {
      this.setToken(response.data.data.token);
    }
    return response.data.data;
  }

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response: AxiosResponse<ApiResponse<AuthResponse>> = await this.api.post('/auth/register', data);
    if (response.data.success && response.data.data) {
      this.setToken(response.data.data.token);
    }
    return response.data.data;
  }

  async getMe(): Promise<Teacher> {
    const response: AxiosResponse<ApiResponse<Teacher>> = await this.api.get('/auth/me');
    return response.data.data;
  }

  async updateProfile(data: Partial<Teacher>): Promise<Teacher> {
    const response: AxiosResponse<ApiResponse<Teacher>> = await this.api.put('/auth/profile', data);
    return response.data.data;
  }

  // Students API
  async getStudents(params?: {
    page?: number;
    limit?: number;
    search?: string;
    grade_level?: string;
    status?: string;
    group_id?: string;
  }): Promise<PaginatedResponse<Student>> {
    const response: AxiosResponse<PaginatedResponse<Student>> = await this.api.get('/students', { params });
    return response.data;
  }

  async getStudent(id: string): Promise<Student> {
    const response: AxiosResponse<ApiResponse<Student>> = await this.api.get(`/students/${id}`);
    return response.data.data;
  }

  async createStudent(data: CreateStudentRequest): Promise<Student> {
    const response: AxiosResponse<ApiResponse<Student>> = await this.api.post('/students', data);
    return response.data.data;
  }

  async updateStudent(id: string, data: Partial<CreateStudentRequest>): Promise<Student> {
    const response: AxiosResponse<ApiResponse<Student>> = await this.api.put(`/students/${id}`, data);
    return response.data.data;
  }

  async deleteStudent(id: string): Promise<void> {
    await this.api.delete(`/students/${id}`);
  }

  async getStudentStats(id: string): Promise<StudentStats> {
    const response: AxiosResponse<ApiResponse<StudentStats>> = await this.api.get(`/students/${id}/stats`);
    return response.data.data;
  }

  // Import API
  async previewImport(file: File): Promise<{
    fileName: string;
    totalRows: number;
    headers: string[];
    autoMapping: Record<string, string>;
    unmappedColumns: string[];
    preview: Record<string, unknown>[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.api.post('/import/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  }

  async validateImport(
    file: File,
    mapping: Record<string, string>,
    requiredFields?: string[]
  ): Promise<{
    fieldMapping: Record<string, string>;
    rows: { data: Record<string, string>; status: string; errors: string[]; warnings: string[] }[];
    stats: { total: number; ready: number; warning: number; error: number };
  }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', JSON.stringify(mapping));
    if (requiredFields) {
      formData.append('requiredFields', JSON.stringify(requiredFields));
    }
    const response = await this.api.post('/import/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  }

  async executeImport(data: {
    fieldMapping: Record<string, string>;
    rows: { data: Record<string, string>; status: string }[];
    groupId: string;
    skipErrors?: boolean;
  }): Promise<{ imported: number; skipped: number; errors: { row: Record<string, string>; error: string }[] }> {
    const response = await this.api.post('/import/execute', data);
    return response.data.data;
  }

  async parsePastedData(text: string): Promise<{
    headers: string[];
    autoMapping: Record<string, string>;
    unmappedColumns: string[];
    totalRows: number;
    preview: Record<string, unknown>[];
    allRows: Record<string, unknown>[];
  }> {
    const response = await this.api.post('/import/paste', { text });
    return response.data.data;
  }

  // Self-Registration API
  async generateRegistrationLink(groupId: string, expiresInHours?: number): Promise<{
    url: string;
    token: string;
    expiresAt: string;
    groupName: string;
    subject: string;
  }> {
    const response = await this.api.post('/students/self-register/link', { groupId, expiresInHours });
    return response.data.data;
  }

  async getRegistrationForm(token: string): Promise<{
    groupName: string;
    teacherName: string;
    fields: string[];
  }> {
    const response = await this.api.get(`/students/self-register/form/${token}`);
    return response.data.data;
  }

  async submitRegistration(token: string, data: { name: string; phone?: string; parent_phone?: string }): Promise<{ studentId: string; studentCode: string }> {
    const response = await this.api.post(`/students/self-register/submit/${token}`, data);
    return response.data.data;
  }

  // Demo Data API
  async seedDemoData(): Promise<{ success: boolean; message: string }> {
    const response = await this.api.post('/import/demo/seed');
    return response.data.data;
  }

  async removeDemoData(): Promise<{ success: boolean; message: string }> {
    const response = await this.api.post('/import/demo/remove');
    return response.data.data;
  }

  // Attendance API
  async getAttendance(params?: {
    page?: number;
    limit?: number;
    student_id?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
    group_id?: string;
  }): Promise<ApiResponse<Attendance[]>> {
    const response: AxiosResponse<ApiResponse<Attendance[]>> = await this.api.get('/attendance', { params });
    return response.data;
  }

  async createAttendance(data: BulkAttendanceRequest): Promise<Attendance[]> {
    const attendance_records = data.attendance.map((record) => ({
      student_id: record.student_id,
      group_id: record.group_id,
      status: record.status,
      notes: record.notes,
      date: record.date || data.date
    }));

    const response: AxiosResponse<ApiResponse<Attendance[]>> = await this.api.post('/attendance', { attendance_records });
    return response.data.data;
  }

  async getAttendanceSummary(params?: {
    start_date?: string;
    end_date?: string;
    student_id?: string;
    group_id?: string;
  }): Promise<AttendanceSummary> {
    const response: AxiosResponse<ApiResponse<AttendanceSummary>> = await this.api.get('/attendance/summary', { params });
    return response.data.data;
  }

  // Grades API
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
    const response: AxiosResponse<PaginatedResponse<Grade>> = await this.api.get('/grades', { params });
    return response.data;
  }

  async createGrade(data: CreateGradeRequest): Promise<Grade> {
    const response: AxiosResponse<ApiResponse<Grade>> = await this.api.post('/grades', data);
    return response.data.data;
  }

  async createBulkGrades(data: BulkGradeRequest): Promise<Grade[]> {
    const response: AxiosResponse<ApiResponse<Grade[]>> = await this.api.post('/grades/bulk', data);
    return response.data.data;
  }

  async updateGrade(id: string, data: Partial<CreateGradeRequest>): Promise<Grade> {
    const response: AxiosResponse<ApiResponse<Grade>> = await this.api.put(`/grades/${id}`, data);
    return response.data.data;
  }

  async deleteGrade(id: string): Promise<void> {
    await this.api.delete(`/grades/${id}`);
  }

  async getGradeStats(): Promise<GradeStats> {
    const response: AxiosResponse<ApiResponse<GradeStats>> = await this.api.get('/grades/stats');
    return response.data.data;
  }

  // Messages & WhatsApp API (consolidated)
  async getConversations(params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Conversation>> {
    const response: AxiosResponse<PaginatedResponse<Conversation>> = await this.api.get('/whatsapp/conversations', { params });
    return response.data;
  }

  async getConversationMessages(id: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Message>> {
    const response: AxiosResponse<PaginatedResponse<Message>> = await this.api.get(`/messages/conversations/${id}`, { params });
    return response.data;
  }

  // Unified message sending (uses WhatsApp)
  async sendMessage(data: {
    phone: string;
    message: string;
  }): Promise<void> {
    await this.api.post('/whatsapp/send-to-number', data);
  }

  async startWhatsAppPairing(): Promise<void> {
    await this.api.post('/whatsapp/pair');
  }

  async requestWhatsAppPairingCode(phone: string): Promise<{ code: string; phone: string }> {
    const response = await this.api.post('/whatsapp/pair-code', { phone });
    return response.data.data;
  }

  async getWhatsAppStatus(): Promise<{ status: string; qr: string | null; phone: string | null }> {
    const response = await this.api.get('/whatsapp/status');
    return response.data.data;
  }

  async logoutWhatsApp(): Promise<{ success: boolean; message: string }> {
    const response = await this.api.post('/whatsapp/logout');
    return response.data;
  }

  async createTeacherAccount(data: {
    name: string;
    email: string;
    password: string;
    role?: 'teacher' | 'admin';
    preferred_language?: string;
  }): Promise<Teacher> {
    const response: AxiosResponse<ApiResponse<Teacher>> = await this.api.post('/auth/admin/create-teacher', data);
    return response.data.data;
  }

  async getMessageStats(): Promise<MessageStats> {
    const response: AxiosResponse<ApiResponse<MessageStats>> = await this.api.get('/messages/stats');
    return response.data.data;
  }

  // Dashboard API
  async getDashboardStats(): Promise<DashboardStats> {
    const response: AxiosResponse<ApiResponse<DashboardStats>> = await this.api.get('/teachers/dashboard');
    return response.data.data;
  }

  // Offerings API
  async getOfferings(): Promise<Offering[]> {
    const response: AxiosResponse<ApiResponse<Offering[]>> = await this.api.get('/offerings');
    return response.data.data;
  }

  async getOffering(id: string): Promise<Offering> {
    const response: AxiosResponse<ApiResponse<Offering>> = await this.api.get(`/offerings/${id}`);
    return response.data.data;
  }

  async deleteOffering(id: string): Promise<void> {
    await this.api.delete(`/offerings/${id}`);
  }

  async createGroup(offeringId: string, data: CreateGroupRequest): Promise<OfferingGroup> {
    const response: AxiosResponse<ApiResponse<OfferingGroup>> = await this.api.post(`/offerings/${offeringId}/groups`, data);
    return response.data.data;
  }

  async updateGroup(offeringId: string, groupId: string, data: Partial<CreateGroupRequest>): Promise<OfferingGroup> {
    const response: AxiosResponse<ApiResponse<OfferingGroup>> = await this.api.put(`/offerings/${offeringId}/groups/${groupId}`, data);
    return response.data.data;
  }

  async enrollStudent(offeringId: string, groupId: string, studentId: string): Promise<void> {
    await this.api.post(`/offerings/${offeringId}/groups/${groupId}/enroll`, { student_id: studentId });
  }

  async unenrollStudent(offeringId: string, groupId: string, studentId: string): Promise<void> {
    await this.api.delete(`/offerings/${offeringId}/groups/${groupId}/enroll/${studentId}`);
  }

  // Settings API
  async getSettings(): Promise<TeacherSettings> {
    const response: AxiosResponse<ApiResponse<TeacherSettings>> = await this.api.get('/teachers/settings');
    return response.data.data;
  }

  async updateSettings(data: UpdateSettingsRequest): Promise<TeacherSettings> {
    const response: AxiosResponse<ApiResponse<TeacherSettings>> = await this.api.put('/teachers/settings', data);
    return response.data.data;
  }

  // Parents API
  async getParents(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<ApiResponse<ParentProfile[]>> {
    const response: AxiosResponse<ApiResponse<ParentProfile[]>> = await this.api.get('/parents', { params });
    return response.data;
  }

  async createParent(data: CreateParentRequest): Promise<ParentProfile> {
    const response: AxiosResponse<ApiResponse<ParentProfile>> = await this.api.post('/parents', data);
    return response.data.data;
  }

  async updateParent(id: string, data: UpdateParentRequest): Promise<ParentProfile> {
    const response: AxiosResponse<ApiResponse<ParentProfile>> = await this.api.put(`/parents/${id}`, data);
    return response.data.data;
  }

  async deleteParent(id: string): Promise<void> {
    await this.api.delete(`/parents/${id}`);
  }

  // Assistants API
  async getAssistants(): Promise<ApiResponse<Array<{
    id: string;
    name: string;
    email: string;
    status: string;
    permissions: Record<string, boolean>;
    created_at: string;
    updated_at: string;
  }>>> {
    const response = await this.api.get('/assistants');
    return response.data;
  }

  async inviteAssistant(email: string, permissions?: Record<string, boolean>): Promise<ApiResponse<{ id: string; email: string; expires_at: string }>> {
    const response = await this.api.post('/assistants/invite', { email, permissions });
    return response.data;
  }

  async inviteAssistantDual(params: { email?: string; phone?: string; deliveryMethod: string; permissions?: Record<string, boolean> }): Promise<ApiResponse<{ id: string; email: string; phone: string; expires_at: string }>> {
    const response = await this.api.post('/assistants/invite', params);
    return response.data;
  }

  async getInviteByToken(token: string): Promise<ApiResponse<{ id: string; teacherName: string; permissions: Record<string, boolean>; expires_at: string }>> {
    const response = await this.api.get(`/assistants/invites/${token}`);
    return response.data;
  }

  async acceptInvite(token: string): Promise<ApiResponse<{ assistantId: string }>> {
    const response = await this.api.post('/assistants/accept', { token });
    return response.data;
  }

  async listPendingInvites(): Promise<ApiResponse<Array<{ id: string; email: string; phone: string; status: string; expires_at: string; created_at: string }>>> {
    const response = await this.api.get('/assistants/invites');
    return response.data;
  }

  async updateAssistantPermissions(id: string, permissions: Record<string, boolean>): Promise<ApiResponse<{ id: string; permissions: Record<string, boolean> }>> {
    const response = await this.api.put(`/assistants/${id}/permissions`, { permissions });
    return response.data;
  }

  async updateAssistantStatus(id: string, status: 'active' | 'inactive'): Promise<ApiResponse<{ id: string; status: string }>> {
    const response = await this.api.put(`/assistants/${id}/status`, { status });
    return response.data;
  }

  async removeAssistant(id: string): Promise<void> {
    await this.api.delete(`/assistants/${id}`);
  }

  // Reports API
  async generateReportComment(studentId: string, groupId?: string): Promise<ApiResponse<{
    id: string;
    draft_text: string;
    status: string;
    created_at: string;
  }>> {
    const response = await this.api.post('/reports/generate-comment', { student_id: studentId, group_id: groupId });
    return response.data;
  }

  async getReportDrafts(params?: { page?: number; limit?: number; status?: string }): Promise<PaginatedResponse<{
    id: string;
    student_id: string;
    group_id: string | null;
    draft_text: string;
    status: string;
    edited_text: string | null;
    sent_at: string | null;
    created_at: string;
    student?: { name: string };
  }>> {
    const response = await this.api.get('/reports/drafts', { params });
    return response.data;
  }

  async updateReportDraft(id: string, data: { edited_text?: string; status?: string }): Promise<ApiResponse<{ id: string; status: string }>> {
    const response = await this.api.put(`/reports/drafts/${id}`, data);
    return response.data;
  }

  async approveReportDraft(id: string): Promise<ApiResponse<{ id: string; status: string }>> {
    const response = await this.api.post(`/reports/drafts/${id}/approve`);
    return response.data;
  }

  async rejectReportDraft(id: string): Promise<ApiResponse<{ id: string; status: string }>> {
    const response = await this.api.post(`/reports/drafts/${id}/reject`);
    return response.data;
  }

  async bulkGenerateComments(groupId: string): Promise<ApiResponse<{ generated: number; drafts: Array<{ id: string; student_id: string; draft_text: string }> }>> {
    const response = await this.api.post('/reports/bulk-generate', { group_id: groupId });
    return response.data;
  }

  async getLatestDigest(): Promise<ApiResponse<{
    id: string;
    week_start: string;
    week_end: string;
    digest_data: {
      improved: Array<{ student_name: string; metric: string; detail: string }>;
      declining: Array<{ student_name: string; metric: string; detail: string }>;
      action_items: string[];
    };
    created_at: string;
  }>> {
    const response = await this.api.get('/reports/weekly-digest');
    return response.data;
  }

  async getDigestByWeek(weekStart: string): Promise<ApiResponse<{
    id: string;
    week_start: string;
    week_end: string;
    digest_data: Record<string, unknown>;
    created_at: string;
  }>> {
    const response = await this.api.get(`/reports/weekly-digest/${weekStart}`);
    return response.data;
  }

  // Notifications API
  async getNotifications(params?: { page?: number; limit?: number; type?: string; unread_only?: boolean }): Promise<PaginatedResponse<{
    id: string;
    type: string;
    title: string;
    body: string | null;
    entity_type: string | null;
    entity_id: string | null;
    is_read: boolean;
    created_at: string;
  }>> {
    const response = await this.api.get('/notifications', { params });
    return response.data;
  }

  async getUnreadNotificationCount(): Promise<ApiResponse<{ count: number }>> {
    const response = await this.api.get('/notifications/unread-count');
    return response.data;
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.api.put(`/notifications/${id}/read`);
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.api.put('/notifications/read-all');
  }

  async deleteNotification(id: string): Promise<void> {
    await this.api.delete(`/notifications/${id}`);
  }

  // Alert Rules API
  async getAlertRules(): Promise<ApiResponse<Array<{
    id: string;
    alert_type: string;
    threshold_value: number;
    comparison: string;
    notification_method: string;
    is_enabled: boolean;
    created_at: string;
  }>>> {
    const response = await this.api.get('/alerts/rules');
    return response.data;
  }

  async createAlertRule(data: {
    alert_type: string;
    threshold_value: number;
    comparison: string;
    notification_method?: string;
  }): Promise<ApiResponse<{ id: string; alert_type: string }>> {
    const response = await this.api.post('/alerts/rules', data);
    return response.data;
  }

  async updateAlertRule(id: string, data: Partial<{
    alert_type: string;
    threshold_value: number;
    comparison: string;
    notification_method: string;
    is_enabled: boolean;
  }>): Promise<ApiResponse<{ id: string }>> {
    const response = await this.api.put(`/alerts/rules/${id}`, data);
    return response.data;
  }

  async deleteAlertRule(id: string): Promise<void> {
    await this.api.delete(`/alerts/rules/${id}`);
  }

  async toggleAlertRule(id: string): Promise<ApiResponse<{ id: string; is_enabled: boolean }>> {
    const response = await this.api.put(`/alerts/rules/${id}/toggle`);
    return response.data;
  }

  async getAlerts(params?: { page?: number; limit?: number; severity?: string; alert_type?: string }): Promise<PaginatedResponse<{
    id: string;
    alert_type: string;
    title: string;
    message: string;
    severity: string;
    is_read: boolean;
    student_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>> {
    const response = await this.api.get('/alerts', { params });
    return response.data;
  }

  async markAlertRead(id: string): Promise<void> {
    await this.api.put(`/alerts/${id}/read`);
  }

  async markAllAlertsRead(): Promise<void> {
    await this.api.put('/alerts/read-all');
  }

  // Grade Analysis API
  async getGroupComparison(offeringId: string): Promise<ApiResponse<Array<{
    group_id: string;
    group_name: string;
    average_score: number;
    student_count: number;
  }>>> {
    const response = await this.api.get('/grade-analysis/group-comparison', { params: { offering_id: offeringId } });
    return response.data;
  }

  async getAtRiskStudents(offeringId: string, params?: { grade_threshold?: number; attendance_threshold?: number }): Promise<ApiResponse<Array<{
    student_id: string;
    student_name: string;
    average_grade: number;
    attendance_rate: number;
    severity: string;
  }>>> {
    const response = await this.api.get('/grade-analysis/at-risk', { params: { offering_id: offeringId, ...params } });
    return response.data;
  }

  async getGradeDistribution(assessmentId: string): Promise<ApiResponse<Array<{
    range: string;
    count: number;
  }>>> {
    const response = await this.api.get(`/grade-analysis/distribution/${assessmentId}`);
    return response.data;
  }

  async getGradeTrends(studentId: string): Promise<ApiResponse<Array<{
    assessment_name: string;
    score: number;
    date: string;
  }>>> {
    const response = await this.api.get(`/grade-analysis/trends/${studentId}`);
    return response.data;
  }

  async getGradeOverview(offeringId: string): Promise<ApiResponse<{
    total_students: number;
    average_score: number;
    highest_score: number;
    lowest_score: number;
    total_assessments: number;
  }>> {
    const response = await this.api.get(`/grade-analysis/overview/${offeringId}`);
    return response.data;
  }

  // Notification Preferences API
  async updateNotificationPreferences(data: {
    attendance_marked?: boolean;
    grade_entered?: boolean;
    whatsapp_sent?: boolean;
    assistant_action?: boolean;
    digest?: boolean;
    quiet_hours_start?: string;
    quiet_hours_end?: string;
  }): Promise<ApiResponse<{ id: string }>> {
    const response = await this.api.put('/teachers/notification-preferences', data);
    return response.data;
  }

  // Password Reset API
  async requestPasswordReset(email: string): Promise<ApiResponse<{ message: string; messageAr: string }>> {
    const response = await this.api.post('/auth/request-reset', { email });
    return response.data;
  }

  async resetPassword(token: string, newPassword: string): Promise<ApiResponse<{ message: string; messageAr: string }>> {
    const response = await this.api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  }
}

// Export class and singleton instance
export { ApiClient };
export const apiClient = new ApiClient();
export default apiClient;
