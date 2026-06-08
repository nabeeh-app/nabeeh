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

const studentsRouter = require('../students');
const { supabase } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/students', studentsRouter);

describe('Students Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/students', () => {
    it('should return paginated students', async () => {
      const mockStudents = [
        { id: 's1', name: 'Ahmed Ali', student_code: 'ST-001', phone: '+201234567890' },
        { id: 's2', name: 'Sara Mohamed', student_code: 'ST-002', phone: '+201234567891' }
      ];

      const chainable = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: mockStudents, error: null, count: 2 });
        })
      };

      supabase.from.mockReturnValue(chainable);

      const res = await request(app).get('/api/students');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
    });

    it('should handle search parameter', async () => {
      const chainable = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [], error: null, count: 0 });
        })
      };

      supabase.from.mockReturnValue(chainable);

      const res = await request(app)
        .get('/api/students')
        .query({ search: 'Ahmed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/students/:id', () => {
    it('should return a single student', async () => {
      const mockStudent = {
        id: 's1',
        name: 'Ahmed Ali',
        student_code: 'ST-001',
        parents: [],
        enrollments: []
      };

      const chainable = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockStudent, error: null })
      };

      supabase.from.mockReturnValue(chainable);

      const res = await request(app).get('/api/students/s1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Ahmed Ali');
    });

    it('should return 404 for non-existent student', async () => {
      const chainable = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
      };

      supabase.from.mockReturnValue(chainable);

      const res = await request(app).get('/api/students/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/students', () => {
    it('should create a student and enroll in group', async () => {
      const mockStudent = { id: 's1', name: 'New Student', student_code: 'ST-003' };

      // Mock group ownership check
      const groupCheckChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { offering: { teacher_id: 'teacher-1' } },
          error: null
        })
      };

      // Mock student insert
      const insertChain = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockStudent, error: null })
          })
        })
      };

      // Mock enrollment insert
      const enrollChain = {
        insert: jest.fn().mockResolvedValue({ error: null })
      };

      supabase.from
        .mockReturnValueOnce(groupCheckChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(enrollChain);

      const res = await request(app)
        .post('/api/students')
        .send({
          name: 'New Student',
          group_id: 'group-1',
          phone: '+201234567890'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/students')
        .send({ phone: '+201234567890' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/students/:id', () => {
    it('should update a student', async () => {
      // Mock ownership check
      const countChain = {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ count: 1 })
          })
        })
      };

      // Mock update
      const updateChain = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 's1', name: 'Updated Name' },
                error: null
              })
            })
          })
        })
      };

      supabase.from
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateChain);

      const res = await request(app)
        .put('/api/students/s1')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/students/:id', () => {
    it('should delete student enrollments', async () => {
      // Mock find enrollments
      const findChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [{ id: 'e1' }], error: null });
        })
      };

      // Mock delete
      const deleteChain = {
        delete: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ error: null })
        })
      };

      supabase.from
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(deleteChain);

      const res = await request(app).delete('/api/students/s1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if student not in teacher classes', async () => {
      const findChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [], error: null });
        })
      };

      supabase.from.mockReturnValueOnce(findChain);

      const res = await request(app).delete('/api/students/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
