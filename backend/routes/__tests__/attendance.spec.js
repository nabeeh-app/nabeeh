const request = require('supertest');
const express = require('express');

jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn()
  }
}));

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'teacher-1', email: 'test@example.com', role: 'teacher' };
    next();
  }
}));

const attendanceRouter = require('../attendance');
const { supabase } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/attendance', attendanceRouter);

describe('Attendance Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/attendance', () => {
    it('should return attendance records for date range', async () => {
      const mockAttendance = [
        {
          id: 'a1',
          date: '2026-06-01',
          status: 'present',
          notes: null,
          enrollment: {
            student: { id: 's1', name: 'Ahmed Ali', student_code: 'ST-001' },
            group: {
              id: 'g1',
              name: 'Group A',
              offering: { subject: { name_en: 'Math' } }
            }
          }
        }
      ];

      const chainable = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: mockAttendance, error: null });
        })
      };

      supabase.from.mockReturnValue(chainable);

      const res = await request(app)
        .get('/api/attendance')
        .query({ start_date: '2026-06-01', end_date: '2026-06-08' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].student.name).toBe('Ahmed Ali');
    });

    it('should filter by student_id', async () => {
      const chainable = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [], error: null });
        })
      };

      supabase.from.mockReturnValue(chainable);

      const res = await request(app)
        .get('/api/attendance')
        .query({ student_id: 's1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/attendance', () => {
    it('should mark attendance successfully', async () => {
      const mockAttendance = [
        { id: 'a1', enrollment_id: 'e1', date: '2026-06-01', status: 'present' }
      ];

      // Mock enrollment lookup
      const enrollChain = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({
            data: [{ id: 'e1', student_id: 's1', group_id: 'g1' }],
            error: null
          });
        })
      };

      // Mock upsert
      const upsertChain = {
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: mockAttendance, error: null })
        })
      };

      supabase.from
        .mockReturnValueOnce(enrollChain)
        .mockReturnValueOnce(upsertChain);

      const res = await request(app)
        .post('/api/attendance')
        .send({
          date: '2026-06-01',
          attendance_records: [
            { student_id: 's1', group_id: 'g1', status: 'present' }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for missing attendance_records', async () => {
      const res = await request(app)
        .post('/api/attendance')
        .send({ date: '2026-06-01' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for empty attendance_records', async () => {
      const res = await request(app)
        .post('/api/attendance')
        .send({ date: '2026-06-01', attendance_records: [] });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/attendance/summary', () => {
    it('should return attendance summary', async () => {
      const mockSummary = [
        { status: 'present' },
        { status: 'present' },
        { status: 'absent' },
        { status: 'late' }
      ];

      const chainable = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: mockSummary, error: null });
        })
      };

      supabase.from.mockReturnValue(chainable);

      const res = await request(app)
        .get('/api/attendance/summary')
        .query({ start_date: '2026-06-01', end_date: '2026-06-08' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_sessions).toBe(4);
      expect(res.body.data.present_count).toBe(2);
      expect(res.body.data.absent_count).toBe(1);
      expect(res.body.data.late_count).toBe(1);
    });
  });
});
