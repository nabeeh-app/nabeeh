const request = require('supertest');
const express = require('express');

jest.mock('uuid', () => ({ v4: () => 'test-token-uuid' }));

jest.mock('../../config/database', () => ({
  supabase: { from: jest.fn() },
  supabaseAdmin: { from: jest.fn(), rpc: jest.fn() }
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
  },
  requirePermission: () => (req, res, next) => next()
}));

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../lib/auditLog', () => ({
  logAudit: jest.fn()
}));

const selfRegRouter = require('../selfRegistration');
const { supabaseAdmin } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/students/self-register', selfRegRouter);
app.use(require('../../middleware/errorHandler'));

function chainable(resolveWith) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveWith),
    insert: jest.fn().mockReturnThis(),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveWith).then(onFulfilled, onRejected);
    }
  };
  return chain;
}

describe('Self Registration link route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a link for an owned group (no ReferenceError)', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce(chainable({
        data: { id: 'g1', name: 'Group', offering: { teacher_id: 'teacher-1' } },
        error: null
      }))
      .mockReturnValueOnce(chainable({ data: null, error: null }));

    const res = await request(app)
      .post('/api/students/self-register/link')
      .send({ groupId: 'g1' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.url).toContain('/register/student?token=');
  });

  it('returns 403 for a foreign group', async () => {
    supabaseAdmin.from.mockReturnValueOnce(chainable({
      data: { id: 'g9', name: 'Other', offering: { teacher_id: 'victim' } },
      error: null
    }));

    const res = await request(app)
      .post('/api/students/self-register/link')
      .send({ groupId: 'g9' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });
});
