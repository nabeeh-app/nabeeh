import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '@/lib/api';

vi.mock('axios', () => {
  const mockAxios = {
    create: vi.fn(() => mockAxios),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
  return { default: mockAxios };
});

describe('ApiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Token Management', () => {
    it('should return null when window is undefined (SSR)', () => {
      expect(apiClient.getToken()).toBeNull();
    });
  });

  describe('login', () => {
    it('should call POST /auth/login and store token', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            teacher: { id: '1', email: 'test@example.com', name: 'Test' },
            token: 'mock-token',
          },
        },
      };

      apiClient.api.post = vi.fn().mockResolvedValue(mockResponse);

      const result = await apiClient.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(apiClient.api.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });
      expect(result.token).toBe('mock-token');
    });
  });

  describe('register', () => {
    it('should call POST /auth/register', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            teacher: { id: '1', email: 'new@example.com', name: 'New User' },
            token: 'mock-token',
          },
        },
      };

      apiClient.api.post = vi.fn().mockResolvedValue(mockResponse);

      const result = await apiClient.register({
        name: 'New User',
        email: 'new@example.com',
        phone: '+201234567890',
        password: 'StrongPass123!',
      });

      expect(apiClient.api.post).toHaveBeenCalledWith('/auth/register', {
        name: 'New User',
        email: 'new@example.com',
        phone: '+201234567890',
        password: 'StrongPass123!',
      });
      expect(result.token).toBe('mock-token');
    });
  });

  describe('getStudents', () => {
    it('should call GET /students with params', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [{ id: '1', name: 'Ahmed' }],
          pagination: { page: 1, limit: 10, total: 1 },
        },
      };

      apiClient.api.get = vi.fn().mockResolvedValue(mockResponse);

      const result = await apiClient.getStudents({ page: 1, limit: 10 });

      expect(apiClient.api.get).toHaveBeenCalledWith('/students', {
        params: { page: 1, limit: 10 },
      });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getAttendance', () => {
    it('should call GET /attendance with date range', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [{ id: '1', date: '2026-06-01', status: 'present' }],
        },
      };

      apiClient.api.get = vi.fn().mockResolvedValue(mockResponse);

      const result = await apiClient.getAttendance({
        start_date: '2026-06-01',
        end_date: '2026-06-08',
      });

      expect(apiClient.api.get).toHaveBeenCalledWith('/attendance', {
        params: { start_date: '2026-06-01', end_date: '2026-06-08' },
      });
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getGrades', () => {
    it('should call GET /grades with student_id', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [{ id: '1', score: 85 }],
          pagination: { page: 1, limit: 10, total: 1 },
        },
      };

      apiClient.api.get = vi.fn().mockResolvedValue(mockResponse);

      const result = await apiClient.getGrades({ student_id: 's1' });

      expect(apiClient.api.get).toHaveBeenCalledWith('/grades', {
        params: { student_id: 's1' },
      });
      expect(result.data).toHaveLength(1);
    });
  });
});
