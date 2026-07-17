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
  validate: (schema) => (req, res, next) => {
    req.validated = {
      query: {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        type: req.query.type || undefined,
        unread_only: req.query.unread_only === 'true' ? true : undefined,
      },
      params: req.params,
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

const notificationsRouter = require('../notifications');
const { supabase, supabaseAdmin } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/notifications', notificationsRouter);
app.use(require('../../middleware/errorHandler'));

function createChainable(resolveWith) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveWith),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    then(onFulfilled, onRejected) {
      return Promise.resolve(resolveWith).then(onFulfilled, onRejected);
    }
  };
  return chain;
}

describe('Notifications Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/notifications', () => {
    it('should return notifications with pagination', async () => {
      supabase.from.mockReturnValueOnce(createChainable({
        data: [{ id: 'n1', title: 'Test', is_read: false }],
        error: null,
        count: 1
      }));

      const res = await request(app)
        .get('/api/notifications')
        .query({ page: 1, limit: 20 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(20);
    });

    it('should use default pagination when no params', async () => {
      supabase.from.mockReturnValueOnce(createChainable({
        data: [],
        error: null,
        count: 0
      }));

      const res = await request(app).get('/api/notifications');

      expect(res.status).toBe(200);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(20);
    });
  });

  describe('GET /api/notifications/unread-count', () => {
    it('should return unread count', async () => {
      supabase.from.mockReturnValueOnce(createChainable({ count: 3, error: null }));

      const res = await request(app).get('/api/notifications/unread-count');

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(3);
    });

    it('should return 500 on error', async () => {
      const errorChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then(onFulfilled, onRejected) {
          return Promise.reject(new Error('DB error')).then(onFulfilled, onRejected);
        }
      };
      supabase.from.mockReturnValueOnce(errorChain);

      const res = await request(app).get('/api/notifications/unread-count');

      expect(res.status).toBe(500);
    });
  });
});
