const request = require('supertest');
const express = require('express');

const mockFrom = jest.fn();
jest.mock('../../config/database', () => ({
  supabase: { from: (...args) => mockFrom(...args) },
  supabaseAdmin: { from: (...args) => mockFrom(...args) }
}));

jest.mock('../../lib/enrollmentChain', () => ({
  verifyOfferingAccess: jest.fn(),
  verifyStudentAccess: jest.fn(),
  verifyGroupAccess: jest.fn(),
  getStudentEnrollmentsForTeacher: jest.fn(),
}));

jest.mock('../../middleware/validate', () => ({
  validate: (schema) => (req, res, next) => {
    req.validated = {
      query: {
        ...req.query,
        grade_threshold: Number(req.query.grade_threshold) || 60,
        attendance_threshold: Number(req.query.attendance_threshold) || 70,
      },
      params: { ...req.params },
    };
    next();
  }
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

const gradeAnalysisRouter = require('../gradeAnalysis');
const { verifyOfferingAccess, getStudentEnrollmentsForTeacher } = require('../../lib/enrollmentChain');

const app = express();
app.use(express.json());
app.use('/api/grade-analysis', gradeAnalysisRouter);

function createChainable(resolveWith) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveWith),
    maybeSingle: jest.fn().mockResolvedValue(resolveWith),
    range: jest.fn().mockReturnThis(),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveWith).then(onFulfilled, onRejected);
    }
  };
  return chain;
}

describe('Grade Analysis Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/grade-analysis/group-comparison', () => {
    it('should return group comparison data', async () => {
      verifyOfferingAccess.mockResolvedValue({ id: 'o1' });
      mockFrom
        .mockReturnValueOnce(createChainable({
          data: [
            { id: 'g1', name: 'Group A', enrollments: [{ id: 'e1', grades: [{ score: 80, assessment: { max_score: 100 } }] }] },
            { id: 'g2', name: 'Group B', enrollments: [{ id: 'e2', grades: [{ score: 90, assessment: { max_score: 100 } }] }] }
          ], error: null
        }));

      const res = await request(app)
        .get('/api/grade-analysis/group-comparison')
        .query({ offering_id: 'o1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].average_score).toBe(80);
      expect(res.body.data[1].average_score).toBe(90);
    });

    it('should return 404 if offering not found', async () => {
      verifyOfferingAccess.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/grade-analysis/group-comparison')
        .query({ offering_id: 'nonexistent' });

      expect(res.status).toBe(404);
    });

    it('should handle groups with no enrollments', async () => {
      verifyOfferingAccess.mockResolvedValue({ id: 'o1' });
      mockFrom
        .mockReturnValueOnce(createChainable({ data: [{ id: 'g1', name: 'Empty', enrollments: [] }], error: null }));

      const res = await request(app)
        .get('/api/grade-analysis/group-comparison')
        .query({ offering_id: 'o1' });

      expect(res.status).toBe(200);
      expect(res.body.data[0].average_score).toBe(0);
      expect(res.body.data[0].student_count).toBe(0);
    });
  });

  describe('GET /api/grade-analysis/at-risk', () => {
    it('should return at-risk students', async () => {
      verifyOfferingAccess.mockResolvedValue({ id: 'o1' });
      mockFrom
        .mockReturnValueOnce(createChainable({
          data: [{
            id: 'e1',
            student_id: 's1',
            students: { name: 'Ahmed', student_id: 'ST-001' },
            group: { id: 'g1' },
            grades: [{ score: 40, assessment: { max_score: 100 } }],
            attendance: [{ status: 'absent' }, { status: 'absent' }, { status: 'present' }]
          }],
          error: null
        }));

      const res = await request(app)
        .get('/api/grade-analysis/at-risk')
        .query({ offering_id: 'o1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].student_name).toBe('Ahmed');
      expect(res.body.data[0].severity).toBe('critical');
    });

    it('should return 404 if offering not found', async () => {
      verifyOfferingAccess.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/grade-analysis/at-risk')
        .query({ offering_id: 'nonexistent' });

      expect(res.status).toBe(404);
    });

    it('should return empty array when no at-risk students', async () => {
      verifyOfferingAccess.mockResolvedValue({ id: 'o1' });
      mockFrom
        .mockReturnValueOnce(createChainable({
          data: [{
            id: 'e1',
            student_id: 's1',
            students: { name: 'Excellent', student_id: 'ST-001' },
            group: { id: 'g1' },
            grades: [{ score: 95, assessment: { max_score: 100 } }],
            attendance: [{ status: 'present' }, { status: 'present' }]
          }],
          error: null
        }));

      const res = await request(app)
        .get('/api/grade-analysis/at-risk')
        .query({ offering_id: 'o1', grade_threshold: 60, attendance_threshold: 70 });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should mark as warning when only grade is below threshold', async () => {
      verifyOfferingAccess.mockResolvedValue({ id: 'o1' });
      mockFrom
        .mockReturnValueOnce(createChainable({
          data: [{
            id: 'e1',
            student_id: 's1',
            students: { name: 'Student', student_id: 'ST-001' },
            group: { id: 'g1' },
            grades: [{ score: 50, assessment: { max_score: 100 } }],
            attendance: [{ status: 'present' }, { status: 'present' }]
          }],
          error: null
        }));

      const res = await request(app)
        .get('/api/grade-analysis/at-risk')
        .query({ offering_id: 'o1', grade_threshold: 60, attendance_threshold: 70 });

      expect(res.status).toBe(200);
      expect(res.body.data[0].severity).toBe('warning');
      expect(res.body.data[0].grade_below_threshold).toBe(true);
      expect(res.body.data[0].attendance_below_threshold).toBe(false);
    });
  });

  describe('GET /api/grade-analysis/distribution/:assessmentId', () => {
    it('should return grade distribution', async () => {
      mockFrom
        .mockReturnValueOnce(createChainable({
          data: { id: 'a1', name: 'Midterm', max_score: 100, offering: { teacher_id: 'teacher-1' } },
          error: null
        }))
        .mockReturnValueOnce(createChainable({ data: [{ score: 80 }, { score: 90 }, { score: 70 }, { score: 60 }], error: null }));

      const res = await request(app).get('/api/grade-analysis/distribution/a1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assessment_name).toBe('Midterm');
      expect(res.body.data.total_students).toBe(4);
      expect(res.body.data.distribution).toHaveLength(10);
    });

    it('should return 404 if assessment not found', async () => {
      mockFrom.mockReturnValueOnce(createChainable({ data: null, error: null }));

      const res = await request(app).get('/api/grade-analysis/distribution/nonexistent');

      expect(res.status).toBe(404);
    });

    it('should return 404 if assessment belongs to another teacher', async () => {
      mockFrom.mockReturnValueOnce(createChainable({
        data: { id: 'a1', name: 'Midterm', max_score: 100, offering: { teacher_id: 'other-teacher' } },
        error: null
      }));

      const res = await request(app).get('/api/grade-analysis/distribution/a1');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/grade-analysis/trends/:studentId', () => {
    it('should return grade trends for student', async () => {
      getStudentEnrollmentsForTeacher.mockResolvedValue([{ id: 'e1' }]);
      mockFrom.mockReturnValueOnce(createChainable({
        data: [
          { score: 70, assessment: { name: 'Quiz 1', date: '2025-01-01', max_score: 100 } },
          { score: 85, assessment: { name: 'Midterm', date: '2025-02-01', max_score: 100 } }
        ],
        error: null
      }));

      const res = await request(app).get('/api/grade-analysis/trends/s1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.student_id).toBe('s1');
      expect(res.body.data.trends).toHaveLength(2);
    });

    it('should return empty trends when no grades', async () => {
      getStudentEnrollmentsForTeacher.mockResolvedValue([{ id: 'e1' }]);
      mockFrom.mockReturnValueOnce(createChainable({ data: [], error: null }));

      const res = await request(app).get('/api/grade-analysis/trends/s1');

      expect(res.status).toBe(200);
      expect(res.body.data.trends).toEqual([]);
    });

    it('should return empty trends when student has no enrollments for teacher', async () => {
      getStudentEnrollmentsForTeacher.mockResolvedValue([]);

      const res = await request(app).get('/api/grade-analysis/trends/s1');

      expect(res.status).toBe(200);
      expect(res.body.data.trends).toEqual([]);
    });
  });

  describe('GET /api/grade-analysis/overview/:offeringId', () => {
    it('should return offering overview stats', async () => {
      mockFrom
        .mockReturnValueOnce(createChainable({
          data: { id: 'o1', subject: { name: 'Math' }, grade_level: { name: 'Grade 10' } },
          error: null
        }))
        .mockReturnValueOnce(createChainable({
          data: [
            { score: 80, assessment: { name: 'Quiz', max_score: 100 }, enrollment: { student_id: 's1', students: { name: 'Ahmed' } } },
            { score: 90, assessment: { name: 'Midterm', max_score: 100 }, enrollment: { student_id: 's2', students: { name: 'Sara' } } }
          ],
          error: null
        }))
        .mockReturnValueOnce(createChainable({ count: 2, error: null }));

      const res = await request(app).get('/api/grade-analysis/overview/o1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.offering_id).toBe('o1');
      expect(res.body.data.subject).toBe('Math');
      expect(res.body.data.grade_level).toBe('Grade 10');
      expect(res.body.data.total_grades).toBe(2);
      expect(res.body.data.average).toBe(85);
      expect(res.body.data.highest).toBe(90);
      expect(res.body.data.lowest).toBe(80);
      expect(res.body.data.pass_rate).toBe(100);
    });

    it('should return 404 if offering not found', async () => {
      mockFrom.mockReturnValueOnce(createChainable({ data: null, error: null }));

      const res = await request(app).get('/api/grade-analysis/overview/nonexistent');

      expect(res.status).toBe(404);
    });

    it('should return zeros when no grades exist', async () => {
      mockFrom
        .mockReturnValueOnce(createChainable({
          data: { id: 'o1', subject: { name: 'Math' }, grade_level: { name: 'Grade 10' } },
          error: null
        }))
        .mockReturnValueOnce(createChainable({ data: [], error: null }))
        .mockReturnValueOnce(createChainable({ count: 0, error: null }));

      const res = await request(app).get('/api/grade-analysis/overview/o1');

      expect(res.status).toBe(200);
      expect(res.body.data.total_grades).toBe(0);
      expect(res.body.data.average).toBe(0);
    });
  });
});
