const request = require('supertest');
const express = require('express');

jest.mock('../../config/database', () => ({
  supabaseAdmin: {
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
  },
  requirePermission: () => (req, res, next) => next()
}));

jest.mock('../../middleware/validate', () => ({
  validate: () => (req, res, next) => next(),
  createGradeSchema: {},
  bulkGradeSchema: {},
  updateGradeSchema: {}
}));

const gradesRouter = require('../grades');
const { supabaseAdmin } = require('../../config/database');

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
            name: 'Midterm',
            max_score: 100,
            date: '2026-06-01',
            offering: {
              teacher_id: 'teacher-1',
              subject: { name_en: 'Math', name_ar: null, code: 'MATH' }
            }
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

      supabaseAdmin.from.mockReturnValue(chainable);

      const res = await request(app).get('/api/grades');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should call eq with student_id filter', async () => {
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

      supabaseAdmin.from.mockReturnValue(chainable);

      const res = await request(app)
        .get('/api/grades')
        .query({ student_id: 's1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(chainable.eq).toHaveBeenCalledWith('enrollments.student_id', 's1');
    });

    it('should call gte/lte for date range filters', async () => {
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

      supabaseAdmin.from.mockReturnValue(chainable);

      const res = await request(app)
        .get('/api/grades')
        .query({ start_date: '2026-06-01', end_date: '2026-06-30' });

      expect(res.status).toBe(200);
      expect(chainable.gte).toHaveBeenCalledWith('assessments.date', '2026-06-01');
      expect(chainable.lte).toHaveBeenCalledWith('assessments.date', '2026-06-30');
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

      supabaseAdmin.from
        .mockReturnValueOnce(resolveChain)
        .mockReturnValueOnce(assessChain)
        .mockReturnValueOnce(gradeChain);

      const res = await request(app)
        .post('/api/grades')
        .send({
          student_id: '550e8400-e29b-41d4-a716-446655440001',
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
        .send({ student_id: '550e8400-e29b-41d4-a716-446655440001' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/grades/bulk', () => {
    it('should bulk create grades', async () => {
      // Mock batch enrollment lookup: from('enrollments').select().in().in().eq()
      const enrollChain = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({
            data: [{
              id: 'e1',
              student_id: '550e8400-e29b-41d4-a716-446655440001',
              group: {
                offering: {
                  id: 'off1',
                  subject: { id: 'sub1', name_en: 'Math', name_ar: null, code: 'MATH' }
                }
              }
            }],
            error: null
          });
        })
      };

      // Mock batch assessment lookup: from('assessments').select().in()
      // Returns empty — forces the code to insert new assessments via .insert().select()
      const assessLookupChain = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [], error: null });
        })
      };

      // Mock bulk insert assessments: from('assessments').insert().select()
      const assessInsertChain = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            then: jest.fn().mockImplementation((resolve) => {
              resolve({
                data: [{ id: 'assess1', offering_id: 'off1', name: 'Midterm', date: new Date().toISOString().split('T')[0] }],
                error: null
              });
            })
          })
        })
      };

      // Mock bulk upsert: from('grades').upsert().select()
      const gradeChain = {
        upsert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            then: jest.fn().mockImplementation((resolve) => {
              resolve({
                data: [{
                  id: 'g1',
                  score: 85,
                  notes: null,
                  enrollment: { student: { name: 'Ahmed', student_id: 'ST-001' } }
                }],
                error: null
              });
            })
          })
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(enrollChain)
        .mockReturnValueOnce(assessLookupChain)
        .mockReturnValueOnce(assessInsertChain)
        .mockReturnValueOnce(gradeChain);

      const res = await request(app)
        .post('/api/grades/bulk')
        .send({
          grades: [
            {
              student_id: '550e8400-e29b-41d4-a716-446655440001',
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

  describe('PUT /api/grades/:id', () => {
    it('should update grade score and assessment name', async () => {
      // Mock fetch current grade with ownership check
      const fetchChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'g1', assessment_id: 'assess1', assessment: { offering: { teacher_id: 'teacher-1' } } },
          error: null
        })
      };

      // Mock assessment update
      const assessUpdateChain = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      };

      // Mock grade update
      const gradeUpdateChain = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      };

      // Mock return updated grade
      const returnChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'g1',
            score: 90,
            notes: null,
            assessment: { name: 'Final', max_score: 100, date: '2026-06-15', offering: { subject: { name_en: 'Math' } } },
            enrollment: { student: { id: 's1', name: 'Ahmed', student_id: 'ST-001' } }
          },
          error: null
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(fetchChain)
        .mockReturnValueOnce(assessUpdateChain)
        .mockReturnValueOnce(gradeUpdateChain)
        .mockReturnValueOnce(returnChain);

      const res = await request(app)
        .put('/api/grades/g1')
        .send({ score: 90, assessment_name: 'Final' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.score).toBe(90);
      expect(res.body.data.assessment_name).toBe('Final');
    });

    it('should return 404 for non-existent grade', async () => {
      const fetchChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      };

      supabaseAdmin.from.mockReturnValueOnce(fetchChain);

      const res = await request(app)
        .put('/api/grades/nonexistent')
        .send({ score: 90 });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/grades/stats', () => {
    it('should return grade statistics', async () => {
      const chainable = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({
            data: [
              {
                score: 85,
                assessment: { name: 'Midterm', max_score: 100, offering: { teacher_id: 'teacher-1', subject: { name_en: 'Math', code: 'MATH' } } },
                enrollment: { student_id: 's1' }
              },
              {
                score: 90,
                assessment: { name: 'Quiz', max_score: 100, offering: { teacher_id: 'teacher-1', subject: { name_en: 'Math', code: 'MATH' } } },
                enrollment: { student_id: 's1' }
              }
            ],
            error: null
          });
        })
      };

      supabaseAdmin.from.mockReturnValue(chainable);

      const res = await request(app).get('/api/grades/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_assessments).toBe(2);
      expect(res.body.data.average_score).toBe(87.5);
      expect(res.body.data.by_subject.Math).toBeDefined();
      expect(res.body.data.by_subject.Math.count).toBe(2);
      expect(res.body.data.by_subject.Math.average).toBe(87.5);
    });
  });

  describe('DELETE /api/grades/:id', () => {
    it('should delete a grade', async () => {
      // Mock ownership check — matches actual route join
      const findChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'g1',
            assessment: { offering: { teacher_id: 'teacher-1' } }
          },
          error: null
        })
      };

      // Mock delete
      const deleteChain = {
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      };

      supabaseAdmin.from
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

      supabaseAdmin.from.mockReturnValueOnce(findChain);

      const res = await request(app).delete('/api/grades/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
