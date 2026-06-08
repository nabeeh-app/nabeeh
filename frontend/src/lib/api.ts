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
  CreateAttendanceRequest,
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

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        // Only auto-logout on 401 (Unauthorized) errors, not on network timeouts or other errors
        if (error.response?.status === 401) {
          this.removeToken();
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Token management
  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nabeeh_token');
    }
    return null;
  }

  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nabeeh_token', token);
    }
  }

  removeToken(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('nabeeh_token');
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

  // Attendance API
  async getAttendance(params?: {
    page?: number;
    limit?: number;
    student_id?: string;
    date_from?: string;
    date_to?: string;
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
    date_from?: string;
    date_to?: string;
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
    date_from?: string;
    date_to?: string;
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
    await this.api.post('/whatsapp/send-test', data);
  }

  async startWhatsAppPairing(): Promise<void> {
    await this.api.post('/whatsapp/pair');
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
    const response: AxiosResponse<Offering[]> = await this.api.get('/offerings');
    return response.data;
  }

  async createGroup(offeringId: string, data: CreateGroupRequest): Promise<OfferingGroup> {
    const response: AxiosResponse<OfferingGroup> = await this.api.post(`/offerings/${offeringId}/groups`, data);
    return response.data;
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
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;
