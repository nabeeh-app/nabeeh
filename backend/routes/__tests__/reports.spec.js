const request = require('supertest');
const express = require('express');

jest.mock('../../config/database', () => ({
  supabaseAdmin: {
    from: jest.fn()
  }
}));

jest.mock('../../middleware/validate', () => ({
  validate: () => (req, res, next) => {
    req.validated = req;
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

jest.mock('../../lib/auditLog', () => ({
  logAudit: jest.fn()
}));

jest.mock('../../lib/aiService', () => ({
  generateReportComment: jest.fn().mockResolvedValue('AI generated comment')
}));

jest.mock('../../lib/jobQueue', () => ({
  createJob: jest.fn().mockReturnValue('job-123'),
  getJob: jest.fn().mockReturnValue({ id: 'job-123', status: 'completed' })
}));

jest.mock('../../lib/whatsappQuery', () => ({
  getStudentGrades: jest.fn().mockResolvedValue({ recentGrades: [{ score: 80, assessment: { name: 'Quiz', max_score: 100 } }] }),
  getAllStudentAttendance: jest.fn().mockResolvedValue([{ status: 'present' }, { status: 'absent' }]),
  findOrCreateConversation: jest.fn().mockResolvedValue({ id: 'conv-1' }),
  saveMessage: jest.fn().mockResolvedValue({})
}));

const reportsRouter = require('../reports');
const { supabaseAdmin } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/reports', reportsRouter);

function createChainable(resolveWith) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveWith),
    maybeSingle: jest.fn().mockResolvedValue(resolveWith),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveWith).then(onFulfilled, onRejected);
    }
  };
  return chain;
}

describe('Reports Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/reports/generate-comment', () => {
    it('should generate a comment successfully', async () => {
      supabaseAdmin.from
        .mockReturnValueOnce(createChainable({ data: { id: 's1', name: 'Ahmed' }, error: null }))
        .mockReturnValueOnce(createChainable({ data: { id: 'e1' }, error: null }))
        .mockReturnValueOnce(createChainable({ data: { name: 'Teacher', business_name: 'School', preferred_language: 'en' }, error: null }))
        .mockReturnValueOnce(createChainable({ data: { id: 'd1', draft_text: 'AI generated comment', status: 'pending' }, error: null }));

      const res = await request(app)
        .post('/api/reports/generate-comment')
        .send({ student_id: 's1' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.draft_text).toBe('AI generated comment');
    });
  });

  describe('GET /api/reports/drafts', () => {
    it('should return drafts list', async () => {
      supabaseAdmin.from.mockReturnValueOnce(createChainable({
        data: [{ id: 'd1', draft_text: 'Test draft', students: { name: 'Ahmed' } }],
        error: null,
        count: 1
      }));

      const res = await request(app).get('/api/reports/drafts');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });
  });

  describe('PUT /api/reports/drafts/:id', () => {
    it('should update draft', async () => {
      supabaseAdmin.from.mockReturnValueOnce(createChainable({
        data: { id: 'd1', draft_text: 'Updated', status: 'edited' },
        error: null
      }));

      const res = await request(app)
        .put('/api/reports/drafts/d1')
        .send({ edited_text: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/reports/drafts/:id/approve', () => {
    it('should approve and send draft', async () => {
      supabaseAdmin.from
        .mockReturnValueOnce(createChainable({ data: { id: 'd1', draft_text: 'Report', student_id: 's1', students: { name: 'Ahmed', id: 's1' } }, error: null }))
        .mockReturnValueOnce(createChainable({ data: [{ parents: { id: 'p1', name: 'Father' } }], error: null }))
        .mockReturnValueOnce(createChainable({ data: null, error: null }))
        .mockReturnValueOnce(createChainable({ data: null, error: null }));

      const res = await request(app).post('/api/reports/drafts/d1/approve');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/reports/drafts/:id/reject', () => {
    it('should reject draft', async () => {
      supabaseAdmin.from.mockReturnValueOnce(createChainable({ data: null, error: null }));

      const res = await request(app).post('/api/reports/drafts/d1/reject');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/reports/bulk-generate', () => {
    it('should create a bulk generate job', async () => {
      supabaseAdmin.from.mockReturnValueOnce(createChainable({ data: { id: 'g1' }, error: null }));

      const res = await request(app)
        .post('/api/reports/bulk-generate')
        .send({ group_id: 'g1' });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.job_id).toBe('job-123');
    });
  });

  describe('GET /api/reports/weekly-digest', () => {
    it('should return latest digest', async () => {
      const chain = createChainable({ data: { id: 'd1', week_start: '2025-01-01' }, error: null });
      chain.limit = jest.fn().mockReturnValue(chain);
      supabaseAdmin.from.mockReturnValueOnce(chain);

      const res = await request(app).get('/api/reports/weekly-digest');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/reports/weekly-digest/:weekStart', () => {
    it('should return digest by week', async () => {
      supabaseAdmin.from.mockReturnValueOnce(createChainable({ data: { id: 'd1', week_start: '2025-01-01' }, error: null }));

      const res = await request(app).get('/api/reports/weekly-digest/2025-01-01');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/reports/jobs/:jobId', () => {
    it('should return job status', async () => {
      const res = await request(app).get('/api/reports/jobs/job-123');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
