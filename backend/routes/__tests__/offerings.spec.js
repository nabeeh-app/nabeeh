const request = require('supertest');
const express = require('express');

jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn()
  },
  supabaseAdmin: {
    from: jest.fn()
  }
}));

jest.mock('../../middleware/validate', () => ({
  validate: () => (req, res, next) => {
    req.validated = req;
    next();
  },
  createOfferingSchema: {},
  createGroupSchema: {},
  updateGroupSchema: {}
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'teacher-1', email: 'test@example.com', role: 'teacher' };
    next();
  },
  requirePermission: () => (req, res, next) => next()
}));

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const offeringsRouter = require('../offerings');
const { supabase, supabaseAdmin } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/offerings', offeringsRouter);
app.use(require('../../middleware/errorHandler'));

function createChainable(resolveWith) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveWith),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation((resolve) => resolve(resolveWith))
  };
  return chain;
}

describe('Offerings Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PUT /api/offerings/:offeringId/groups/:groupId', () => {
    it('should update group successfully', async () => {
      supabase.from.mockReturnValueOnce(createChainable({ data: { id: 'o1' }, error: null }));
      supabaseAdmin.from.mockReturnValueOnce(createChainable({ data: { id: 'g1', name: 'Updated Group' }, error: null }));

      const res = await request(app)
        .put('/api/offerings/o1/groups/g1')
        .send({ name: 'Updated Group' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Group');
    });

    it('should return 403 if offering not found', async () => {
      supabase.from.mockReturnValueOnce(createChainable({ data: null, error: null }));

      const res = await request(app)
        .put('/api/offerings/o1/groups/g1')
        .send({ name: 'Updated Group' });

      expect(res.status).toBe(403);
    });

    it('should return 400 if no valid fields', async () => {
      supabase.from.mockReturnValueOnce(createChainable({ data: { id: 'o1' }, error: null }));

      const res = await request(app)
        .put('/api/offerings/o1/groups/g1')
        .send({ invalid_field: 'test' });

      expect(res.status).toBe(400);
    });
  });
});
