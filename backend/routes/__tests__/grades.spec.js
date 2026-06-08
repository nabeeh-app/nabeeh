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

const gradesRouter = require('../grades');
const { supabase } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/grades', gradesRouter);

describe('Grades Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/grades', () => {
    it('should return grades list', async () => {
      const mockGrades = [
        {
          id: 'g1',
          score: 85,
          assessment: {
            title: 'Midterm',
            total_marks: 100,
            date: '2026-06-01',
            offering: { subject: { name_en: 'Math' } }
          },
          enrollment: {
            student: { id: 's1', name: 'Ahmed', student_code: 'ST-001' }
          }
        }
      ];

      const chainable = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: mockGrades, error: null });
        })
      };

      supabase.from.mockReturnValue(chainable);

      const res = await request(app).get('/api/grades');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should filter by student_id', async () => {
      const chainable = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [], error: null });
        })
      };

      supabase.from.mockReturnValue(chainable);

      const res = await request(app)
        .get('/api/grades')
        .query({ student_id: 's1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/grades', () => {
    it('should create a grade', async () => {
      // Mock resolveEnrollmentAndOffering
      const resolveChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({
            data: [{ id: 'e1', group: { offering: { id: 'off1' } } }],
            error: null
          });
        })
      };

      // Mock find or create assessment
      const assessChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'assess1' }, error: null })
      };

      // Mock upsert grade
      const gradeChain = {
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'g1', score: 85, enrollment_id: 'e1', assessment_id: 'assess1' },
              error: null
            })
          })
        })
      };

      supabase.from
        .mockReturnValueOnce(resolveChain)
        .mockReturnValueOnce(assessChain)
        .mockReturnValueOnce(gradeChain);

      const res = await request(app)
        .post('/api/grades')
        .send({
          student_id: 's1',
          subject: 'Math',
          assessment_name: 'Midterm',
          score: 85,
          max_score: 100
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/grades')
        .send({ student_id: 's1' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/grades/bulk', () => {
    it('should bulk create grades', async () => {
      // Mock resolveEnrollmentAndOffering
      const resolveChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({
            data: [{ id: 'e1', group: { offering: { id: 'off1' } } }],
            error: null
          });
        })
      };

      // Mock find assessment
      const assessChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'assess1' }, error: null })
      };

      // Mock upsert grade
      const gradeChain = {
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'g1',
                score: 85,
                enrollment: { student: { name: 'Ahmed', student_id: 'ST-001' } }
              },
              error: null
            })
          })
        })
      };

      supabase.from
        .mockReturnValueOnce(resolveChain)
        .mockReturnValueOnce(assessChain)
        .mockReturnValueOnce(gradeChain);

      const res = await request(app)
        .post('/api/grades/bulk')
        .send({
          grades: [
            {
              student_id: 's1',
              subject: 'Math',
              assessment_name: 'Midterm',
              score: 85,
              max_score: 100
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for missing grades array', async () => {
      const res = await request(app)
        .post('/api/grades/bulk')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/grades/:id', () => {
    it('should delete a grade', async () => {
      // Mock ownership check
      const findChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'g1', assessment: { offering: { teacher_id: 'teacher-1' } } },
          error: null
        })
      };

      // Mock delete
      const deleteChain = {
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      };

      supabase.from
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(deleteChain);

      const res = await request(app).delete('/api/grades/g1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent grade', async () => {
      const findChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      };

      supabase.from.mockReturnValueOnce(findChain);

      const res = await request(app).delete('/api/grades/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
