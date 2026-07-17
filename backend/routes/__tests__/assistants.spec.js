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

jest.mock('../../lib/emailTemplates', () => ({
  getAssistantInviteTemplate: jest.fn().mockReturnValue({ subject: 'Invite', html: '<p>Invite</p>' })
}));

jest.mock('../../lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../../lib/sessionManager', () => ({
  getSession: jest.fn().mockReturnValue(null)
}));

const assistantsRouter = require('../assistants');
const { supabase, supabaseAdmin } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/assistants', assistantsRouter);
app.use(require('../../middleware/errorHandler'));

function createChainable(resolveWith) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveWith),
    maybeSingle: jest.fn().mockResolvedValue(resolveWith),
    in: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveWith).then(onFulfilled, onRejected);
    }
  };
  return chain;
}

describe('Assistants Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/assistants/invite', () => {
    it('should return 403 if tier is unsupported', async () => {
      supabase.from
        .mockReturnValueOnce(createChainable({ data: { subscription_tier: 'enterprise' }, error: null }))
        .mockReturnValueOnce(createChainable({ count: 0, error: null }))
        .mockReturnValueOnce(createChainable({ data: null }))
        .mockReturnValueOnce(createChainable({ data: null }));

      const res = await request(app)
        .post('/api/assistants/invite')
        .send({ email: 'new@example.com', deliveryMethod: 'email' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('TIER_LIMIT');
    });

    it('should return 403 if invite limit reached', async () => {
      supabase.from
        .mockReturnValueOnce(createChainable({ data: { subscription_tier: 'basic' }, error: null }))
        .mockReturnValueOnce(createChainable({ count: 5, error: null }))
        .mockReturnValueOnce(createChainable({ data: null }))
        .mockReturnValueOnce(createChainable({ data: null }));

      const res = await request(app)
        .post('/api/assistants/invite')
        .send({ email: 'new@example.com', deliveryMethod: 'email' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('INVITE_LIMIT');
    });

    it('should return 409 if pending invite already exists', async () => {
      supabase.from
        .mockReturnValueOnce(createChainable({ data: { subscription_tier: 'basic' }, error: null }))
        .mockReturnValueOnce(createChainable({ count: 0, error: null }))
        .mockReturnValueOnce(createChainable({ data: { id: 'existing' } }))
        .mockReturnValueOnce(createChainable({ data: null }));

      const res = await request(app)
        .post('/api/assistants/invite')
        .send({ email: 'new@example.com', deliveryMethod: 'email' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('INVITE_EXISTS');
    });

    it('should return 409 if user is already an assistant', async () => {
      supabase.from
        .mockReturnValueOnce(createChainable({ data: { subscription_tier: 'basic' }, error: null }))
        .mockReturnValueOnce(createChainable({ count: 0, error: null }))
        .mockReturnValueOnce(createChainable({ data: null }))
        .mockReturnValueOnce(createChainable({ data: { id: 'existing-user' } }))
        .mockReturnValueOnce(createChainable({ data: { id: 'link-1' } }));

      const res = await request(app)
        .post('/api/assistants/invite')
        .send({ email: 'new@example.com', deliveryMethod: 'email' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('ALREADY_ASSISTANT');
    });
  });
});
