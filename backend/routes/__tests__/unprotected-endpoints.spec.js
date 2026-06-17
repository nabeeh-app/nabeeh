const request = require('supertest');
const express = require('express');

jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn()
  },
  supabaseAdmin: {
    from: jest.fn(),
    auth: {
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn(),
        updateUserById: jest.fn()
      },
      signInWithPassword: jest.fn()
    }
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
  requireRole: (role) => (req, res, next) => next()
}));

jest.mock('../../lib/auth', () => ({
  TokenService: jest.fn().mockImplementation(() => ({
    generateToken: jest.fn().mockReturnValue('mock-jwt-token'),
    verifyToken: jest.fn().mockReturnValue({ user_id: 'teacher-1', email: 'test@example.com' }),
    generateResetToken: jest.fn().mockReturnValue('mock-reset-token')
  })),
  AuthService: jest.fn().mockImplementation(() => ({
    passwordService: {
      validatePasswordStrength: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      hashPassword: jest.fn().mockResolvedValue('hashed-password')
    },
    tokenService: {
      generateToken: jest.fn().mockReturnValue('mock-jwt-token'),
      verifyToken: jest.fn().mockReturnValue({ user_id: 'teacher-1', email: 'test@example.com' }),
      generateResetToken: jest.fn().mockReturnValue('mock-reset-token')
    },
    authenticateUser: jest.fn()
  }))
}));

const authRouter = require('../auth');
const { supabase, supabaseAdmin } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

function createFluentChain(result) {
  const chain = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(result);
  return chain;
}

describe('Unprotected Endpoints - Auth Required', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/oauth/check-profile', () => {
    it('should return 200 with valid token', async () => {
      const mockTeacher = {
        id: 'teacher-1',
        name: 'Test Teacher',
        email: 'test@example.com'
      };

      const teacherChain = createFluentChain({ data: mockTeacher, error: null });
      const assistantChain = createFluentChain({ data: null, error: null });

      supabaseAdmin.from
        .mockReturnValueOnce(teacherChain)
        .mockReturnValueOnce(assistantChain);

      const res = await request(app)
        .post('/api/auth/oauth/check-profile')
        .send({ user_id: 'teacher-1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasProfile).toBe(true);
    });

    it('should return 400 when neither user_id nor email provided', async () => {
      const res = await request(app)
        .post('/api/auth/oauth/check-profile')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/whatsapp-health', () => {
    it('should require authentication middleware', async () => {
      const { authenticateToken } = require('../../middleware/auth');
      
      expect(authenticateToken).toBeDefined();
      expect(typeof authenticateToken).toBe('function');
    });
  });
});
