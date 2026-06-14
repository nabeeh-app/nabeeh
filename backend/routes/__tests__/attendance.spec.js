const request = require('supertest');
const express = require('express');

jest.mock('../../config/database', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    rpc: jest.fn()
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
  },
  requirePermission: () => (req, res, next) => next()
}));

jest.mock('../../middleware/validate', () => ({
  validate: () => (req, res, next) => next(),
  markAttendanceSchema: {},
  updateAttendanceSchema: {}
}));

const attendanceRouter = require('../attendance');
const { supabaseAdmin } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/attendance', attendanceRouter);

describe('Attendance Routes', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
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
          },
          session: { date: '2026-06-01' }
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

      supabaseAdmin.from.mockReturnValue(chainable);

      const res = await request(app)
        .get('/api/attendance')
        .query({ start_date: '2026-06-01', end_date: '2026-06-08' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].student.name).toBe('Ahmed Ali');
    });

    it('should call eq with student_id filter', async () => {
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

      supabaseAdmin.from.mockReturnValue(chainable);

      const res = await request(app)
        .get('/api/attendance')
        .query({ student_id: 's1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(chainable.eq).toHaveBeenCalledWith('enrollment.student_id', 's1');
    });
  });

  describe('POST /api/attendance', () => {
    it('should mark attendance successfully', async () => {
      const studentUuid = '550e8400-e29b-41d4-a716-446655440001';
      const groupUuid = '550e8400-e29b-41d4-a716-446655440002';

      const mockAttendance = [
        { id: 'a1', enrollment_id: 'e1', date: '2026-06-01', status: 'present' }
      ];

      // Mock enrollment lookup — IDs must match request body
      const enrollChain = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({
            data: [{ id: 'e1', student_id: studentUuid, group_id: groupUuid }],
            error: null
          });
        })
      };

      // Mock upsert — .upsert(records, opts).select() returns { data, error }
      const upsertChain = {
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ data: mockAttendance, error: null })
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(enrollChain)
        .mockReturnValueOnce(upsertChain);

      const res = await request(app)
        .post('/api/attendance')
        .send({
          date: '2026-06-01',
          attendance_records: [
            { student_id: studentUuid, group_id: groupUuid, status: 'present' }
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
    it('should calculate attendance_rate as present/total', async () => {
      supabaseAdmin.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            total_sessions: 4,
            present_count: 2,
            absent_count: 1,
            late_count: 1,
            excused_count: 0,
            attendance_rate: 50
          },
          error: null
        })
      });

      const res = await request(app)
        .get('/api/attendance/summary')
        .query({ start_date: '2026-06-01', end_date: '2026-06-08' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_sessions).toBe(4);
      expect(res.body.data.present_count).toBe(2);
      expect(res.body.data.absent_count).toBe(1);
      expect(res.body.data.late_count).toBe(1);
      expect(res.body.data.excused_count).toBe(0);
      expect(res.body.data.attendance_rate).toBe(50);
    });

    it('should return 0 attendance_rate when no records', async () => {
      supabaseAdmin.rpc.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            total_sessions: 0,
            present_count: 0,
            absent_count: 0,
            late_count: 0,
            excused_count: 0,
            attendance_rate: 0
          },
          error: null
        })
      });

      const res = await request(app)
        .get('/api/attendance/summary')
        .query({ start_date: '2026-06-01', end_date: '2026-06-08' });

      expect(res.status).toBe(200);
      expect(res.body.data.attendance_rate).toBe(0);
    });
  });

  describe('PATCH /api/attendance/:id', () => {
    it('should update attendance status', async () => {
      const fetchChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'a1',
            enrollment: { teacher_id: 'teacher-1' }
          },
          error: null
        })
      };

      const updateChain = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 'a1', status: 'present', notes: null },
                error: null
              })
            })
          })
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(fetchChain)
        .mockReturnValueOnce(updateChain);

      const res = await request(app)
        .patch('/api/attendance/a1')
        .send({ status: 'present' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('present');
    });

    it('should return 404 for non-existent record', async () => {
      const fetchChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      };

      supabaseAdmin.from.mockReturnValueOnce(fetchChain);

      const res = await request(app)
        .patch('/api/attendance/nonexistent')
        .send({ status: 'present' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 403 if record belongs to another teacher', async () => {
      const fetchChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'a1',
            enrollment: { teacher_id: 'other-teacher' }
          },
          error: null
        })
      };

      supabaseAdmin.from.mockReturnValueOnce(fetchChain);

      const res = await request(app)
        .patch('/api/attendance/a1')
        .send({ status: 'present' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/attendance/lock', () => {
    it('should acquire a lock when no existing lock', async () => {
      // First call: check for existing lock → none found
      const noLockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      };

      // Second call: insert new lock
      const insertChain = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'lock-1',
                session_id: 'sess-1',
                student_id: 'stu-1',
                locked_by: 'teacher-1',
                locked_by_type: 'teacher',
                locked_at: new Date().toISOString()
              },
              error: null
            })
          })
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(noLockChain)
        .mockReturnValueOnce(insertChain);

      const res = await request(app)
        .post('/api/attendance/lock')
        .send({ session_id: 'sess-1', student_id: 'stu-1' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Lock acquired');
      expect(res.body.data.locked_by).toBe('teacher-1');
    });

    it('should return 409 when lock is held by another user and not expired', async () => {
      const existingLock = {
        id: 'lock-other',
        locked_by: 'other-teacher',
        locked_by_type: 'teacher',
        locked_at: new Date().toISOString() // Just now — not expired
      };

      const lockChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: existingLock, error: null })
      };

      supabaseAdmin.from.mockReturnValueOnce(lockChain);

      const res = await request(app)
        .post('/api/attendance/lock')
        .send({ session_id: 'sess-1', student_id: 'stu-1' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('LOCK_CONFLICT');
      expect(res.body.data.locked_by).toBe('other-teacher');
    });

    it('should auto-release expired lock and re-acquire', async () => {
      const expiredLock = {
        id: 'lock-expired',
        locked_by: 'other-teacher',
        locked_by_type: 'teacher',
        locked_at: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 min ago — expired
      };

      // Check existing lock
      const lockCheckChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: expiredLock, error: null })
      };

      // Delete expired lock
      const deleteChain = {
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      };

      // Insert new lock
      const insertChain = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'lock-new',
                session_id: 'sess-1',
                student_id: 'stu-1',
                locked_by: 'teacher-1',
                locked_by_type: 'teacher',
                locked_at: new Date().toISOString()
              },
              error: null
            })
          })
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(lockCheckChain)
        .mockReturnValueOnce(deleteChain)
        .mockReturnValueOnce(insertChain);

      const res = await request(app)
        .post('/api/attendance/lock')
        .send({ session_id: 'sess-1', student_id: 'stu-1' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.locked_by).toBe('teacher-1');
    });

    it('should return 400 for missing session_id', async () => {
      const res = await request(app)
        .post('/api/attendance/lock')
        .send({ student_id: 'stu-1' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for missing student_id', async () => {
      const res = await request(app)
        .post('/api/attendance/lock')
        .send({ session_id: 'sess-1' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/attendance/lock', () => {
    it('should release a lock held by the current user', async () => {
      const deleteChain = {
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null })
            })
          })
        })
      };

      supabaseAdmin.from.mockReturnValueOnce(deleteChain);

      const res = await request(app)
        .delete('/api/attendance/lock')
        .send({ session_id: 'sess-1', student_id: 'stu-1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Lock released');
    });

    it('should return 400 for missing params', async () => {
      const res = await request(app)
        .delete('/api/attendance/lock')
        .send({ session_id: 'sess-1' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/attendance/lock/:sessionId/:studentId', () => {
    it('should return locked: false when no lock exists', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      };

      supabaseAdmin.from.mockReturnValueOnce(chain);

      const res = await request(app)
        .get('/api/attendance/lock/sess-1/stu-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.locked).toBe(false);
    });

    it('should return locked: true with lock details when lock is active', async () => {
      const activeLock = {
        id: 'lock-1',
        locked_by: 'teacher-1',
        locked_by_type: 'teacher',
        locked_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
      };

      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: activeLock, error: null })
      };

      supabaseAdmin.from.mockReturnValueOnce(chain);

      const res = await request(app)
        .get('/api/attendance/lock/sess-1/stu-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.locked).toBe(true);
      expect(res.body.data.locked_by).toBe('teacher-1');
    });

    it('should auto-release expired lock and return locked: false', async () => {
      const expiredLock = {
        id: 'lock-expired',
        locked_by: 'other-teacher',
        locked_by_type: 'teacher',
        locked_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        expires_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      };

      const fetchChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: expiredLock, error: null })
      };

      const deleteChain = {
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(fetchChain)
        .mockReturnValueOnce(deleteChain);

      const res = await request(app)
        .get('/api/attendance/lock/sess-1/stu-1');

      expect(res.status).toBe(200);
      expect(res.body.data.locked).toBe(false);
    });
  });
});
