const request = require('supertest');
const express = require('express');

jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn()
  }
}));

jest.mock('../../middleware/validate', () => ({
  validate: () => (req, res, next) => {
    req.validated = req;
    next();
  },
  updateProfileSchema: {},
  updateSettingsSchema: {}
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'teacher-1', email: 'test@example.com', role: 'teacher' };
    next();
  }
}));

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const teachersRouter = require('../teachers');
const { supabase } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/teachers', teachersRouter);
app.use(require('../../middleware/errorHandler'));

function createChainable(resolveWith) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveWith),
    upsert: jest.fn().mockReturnThis(),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveWith).then(onFulfilled, onRejected);
    }
  };
  return chain;
}

describe('Teachers Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/teachers/profile', () => {
    it('should return teacher profile with student count', async () => {
      supabase.from
        .mockReturnValueOnce(createChainable({ data: { id: 'teacher-1', name: 'Test Teacher', email: 'test@example.com' }, error: null }));
      supabase.rpc
        .mockReturnValueOnce(Promise.resolve({ data: 5, error: null }));

      const res = await request(app).get('/api/teachers/profile');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Teacher');
      expect(res.body.data.students.count).toBe(5);
    });

    it('should default student count to 0 if null', async () => {
      supabase.from
        .mockReturnValueOnce(createChainable({ data: { id: 'teacher-1', name: 'Test Teacher' }, error: null }));
      supabase.rpc
        .mockReturnValueOnce(Promise.resolve({ data: null, error: null }));

      const res = await request(app).get('/api/teachers/profile');

      expect(res.status).toBe(200);
      expect(res.body.data.students.count).toBe(0);
    });

    it('should return 500 on database error', async () => {
      supabase.from.mockReturnValueOnce(createChainable({ data: null, error: { message: 'DB error' } }));

      const res = await request(app).get('/api/teachers/profile');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/teachers/dashboard', () => {
    it('should return dashboard stats', async () => {
      const statsJson = JSON.stringify({ student_count: 10, parent_count: 5, today_attendance: 3, weekly_messages: 8 });

      supabase.rpc.mockReturnValueOnce(Promise.resolve({ data: statsJson, error: null }));
      supabase.from
        .mockReturnValueOnce(createChainable({ data: [], error: null }))
        .mockReturnValueOnce(createChainable({ data: [], error: null }));

      const res = await request(app).get('/api/teachers/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.stats.total_students).toBe(10);
      expect(res.body.data.stats.total_parents).toBe(5);
    });

    it('should handle stats returned as object (not string)', async () => {
      const statsJson = { student_count: 5, parent_count: 2, today_attendance: 1, weekly_messages: 3 };

      supabase.rpc.mockReturnValueOnce(Promise.resolve({ data: statsJson, error: null }));
      supabase.from
        .mockReturnValueOnce(createChainable({ data: [], error: null }))
        .mockReturnValueOnce(createChainable({ data: [], error: null }));

      const res = await request(app).get('/api/teachers/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.data.stats.total_students).toBe(5);
    });

    it('should format recent grades', async () => {
      const statsJson = JSON.stringify({ student_count: 0, parent_count: 0 });

      supabase.rpc.mockReturnValueOnce(Promise.resolve({ data: statsJson, error: null }));
      supabase.from
        .mockReturnValueOnce(createChainable({
          data: [{
            score: 90, assessment: { name: 'Midterm', date: '2025-02-01', offering: { teacher_id: 'teacher-1' } },
            enrollment: { student: { name: 'Ahmed', student_id: 'ST-001' } }
          }], error: null
        }))
        .mockReturnValueOnce(createChainable({ data: [], error: null }));

      const res = await request(app).get('/api/teachers/dashboard');

      expect(res.status).toBe(200);
      expect(res.body.data.recent_grades).toHaveLength(1);
      expect(res.body.data.recent_grades[0].student_name).toBe('Ahmed');
    });
  });

  describe('GET /api/teachers/settings', () => {
    it('should return teacher settings', async () => {
      supabase.from.mockReturnValueOnce(createChainable({
        data: { theme: 'dark', language: 'ar', notifications: { attendance: true } },
        error: null
      }));

      const res = await request(app).get('/api/teachers/settings');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.theme).toBe('dark');
    });

    it('should return defaults when no settings exist', async () => {
      supabase.from.mockReturnValueOnce(createChainable({ data: null, error: null }));

      const res = await request(app).get('/api/teachers/settings');

      expect(res.status).toBe(200);
      expect(res.body.data.theme).toBe('system');
      expect(res.body.data.language).toBe('en');
    });
  });

  describe('PUT /api/teachers/settings', () => {
    it('should update settings successfully', async () => {
      supabase.from.mockReturnValueOnce(createChainable({
        data: { theme: 'dark', language: 'ar', notifications: {} },
        error: null
      }));

      const res = await request(app)
        .put('/api/teachers/settings')
        .send({ theme: 'dark', language: 'ar' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Settings updated successfully');
    });

    it('should return 400 on database error', async () => {
      supabase.from.mockReturnValueOnce(createChainable({ data: null, error: { message: 'DB error' } }));

      const res = await request(app)
        .put('/api/teachers/settings')
        .send({ theme: 'dark' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/teachers/notification-preferences', () => {
    it('should update notification preferences', async () => {
      supabase.from
        .mockReturnValueOnce(createChainable({
          data: { notification_preferences: {} },
          error: null
        }))
        .mockReturnValueOnce(createChainable({
          data: { notification_preferences: { grade_entered: true, attendance_marked: false } },
          error: null
        }));

      const res = await request(app)
        .put('/api/teachers/notification-preferences')
        .send({ grade_entered: true, attendance_marked: false });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.grade_entered).toBe(true);
    });

    it('should merge with existing preferences', async () => {
      supabase.from
        .mockReturnValueOnce(createChainable({
          data: { notification_preferences: { digest: true } },
          error: null
        }))
        .mockReturnValueOnce(createChainable({
          data: { notification_preferences: { digest: true, alert: false } },
          error: null
        }));

      const res = await request(app)
        .put('/api/teachers/notification-preferences')
        .send({ alert: false });

      expect(res.status).toBe(200);
      expect(res.body.data.digest).toBe(true);
    });
  });
});
