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
  },
  createParentSchema: {},
  updateParentSchema: {}
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

const parentsRouter = require('../parents');
const { supabaseAdmin } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/parents', parentsRouter);

function createChainable(resolveWith) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveWith),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveWith).then(onFulfilled, onRejected);
    }
  };
  return chain;
}

describe('Parents Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/parents', () => {
    it('should return parents for enrolled students', async () => {
      supabaseAdmin.from
        .mockReturnValueOnce(createChainable({ data: [{ student_id: 's1' }, { student_id: 's2' }], error: null }))
        .mockReturnValueOnce(createChainable({ data: [{ id: 'p1', name: 'Father', phone: '123', student: { id: 's1', name: 'Ahmed' } }], error: null }));

      const res = await request(app).get('/api/parents');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return 403 for unauthorized student access', async () => {
      supabaseAdmin.from
        .mockReturnValueOnce(createChainable({ data: [{ student_id: 's1' }], error: null }))
        .mockReturnValueOnce(createChainable({ data: [], error: null }));

      const res = await request(app).get('/api/parents').query({ student_id: 's-other' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return empty array when teacher has no students', async () => {
      supabaseAdmin.from.mockReturnValueOnce(createChainable({ data: [], error: null }));

      const res = await request(app).get('/api/parents');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return 400 on database error', async () => {
      supabaseAdmin.from
        .mockReturnValueOnce(createChainable({ data: [{ student_id: 's1' }], error: null }))
        .mockReturnValueOnce(createChainable({ data: null, error: { message: 'DB error' } }));

      const res = await request(app).get('/api/parents');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/parents', () => {
    it('should create a parent successfully', async () => {
      supabaseAdmin.from
        .mockReturnValueOnce(createChainable({ data: [{ id: 'e1' }], error: null }))
        .mockReturnValueOnce(createChainable({ data: { id: 'p1', name: 'Mother', phone: '456', student: { name: 'Ahmed' } }, error: null }));

      const res = await request(app)
        .post('/api/parents')
        .send({ student_id: 's1', name: 'Mother', phone: '456', relationship: 'mother' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/parents')
        .send({ name: 'Mother' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 on database error', async () => {
      supabaseAdmin.from
        .mockReturnValueOnce(createChainable({ data: [{ id: 'e1' }], error: null }))
        .mockReturnValueOnce(createChainable({ data: null, error: { message: 'DB error' } }));

      const res = await request(app)
        .post('/api/parents')
        .send({ student_id: 's1', name: 'Mother', phone: '456', relationship: 'mother' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
