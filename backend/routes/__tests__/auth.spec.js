const request = require('supertest');
const express = require('express');

// Mock dependencies before importing the router
jest.mock('../../config/database', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    auth: {
      admin: {
        createUser: jest.fn(),
        deleteUser: jest.fn()
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

const mockAuthenticateUser = jest.fn();
const mockGenerateToken = jest.fn().mockReturnValue('mock-jwt-token');
const mockVerifyToken = jest.fn().mockReturnValue({ user_id: 'teacher-1', email: 'test@example.com' });
const mockGenerateResetToken = jest.fn().mockReturnValue('mock-reset-token');
const mockValidatePasswordStrength = jest.fn().mockReturnValue({ isValid: true, errors: [] });
const mockHashPassword = jest.fn().mockResolvedValue('hashed-password');

jest.mock('../../lib/auth', () => ({
  TokenService: jest.fn().mockImplementation(() => ({
    generateToken: mockGenerateToken,
    verifyToken: mockVerifyToken,
    generateResetToken: mockGenerateResetToken
  })),
  AuthService: jest.fn().mockImplementation(() => ({
    passwordService: {
      validatePasswordStrength: mockValidatePasswordStrength,
      hashPassword: mockHashPassword
    },
    tokenService: {
      generateToken: mockGenerateToken,
      verifyToken: mockVerifyToken,
      generateResetToken: mockGenerateResetToken
    },
    authenticateUser: mockAuthenticateUser
  }))
}));

const authRouter = require('../auth');
const { supabaseAdmin } = require('../../config/database');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new teacher successfully', async () => {
      const mockTeacher = {
        id: 'new-teacher-1',
        email: 'new@example.com',
        name: 'New Teacher',
        phone: '+201234567890',
        business_name: null,
        subjects: null,
        whatsapp_number: null
      };

      // Mock getUserByEmail (returns null = no existing user)
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Mock auth.admin.createUser
      supabaseAdmin.auth.admin.createUser.mockResolvedValueOnce({
        data: { user: { id: 'new-teacher-1' } },
        error: null
      });

      // Mock teachers.insert
      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockTeacher, error: null })
          })
        })
      });

      // Mock auth_audit_log.insert
      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New Teacher',
          email: 'new@example.com',
          password: 'StrongPass123!'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBe('mock-jwt-token');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      mockAuthenticateUser.mockResolvedValueOnce({
        success: true,
        user: { id: 'teacher-1', email: 'test@example.com', name: 'Test Teacher', role: 'teacher' },
        token: 'mock-jwt-token',
        message: 'Login successful',
        messageAr: 'تم تسجيل الدخول بنجاح'
      });

      // Mock teachers.select for profile
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'teacher-1',
                email: 'test@example.com',
                name: 'Test Teacher',
                phone: null,
                business_name: null,
                subjects: null,
                whatsapp_number: null
              },
              error: null
            })
          })
        })
      });

      // Mock updateLastLogin
      supabaseAdmin.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      // Mock auth_audit_log.insert
      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for missing email or password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/verify-token', () => {
    it('should verify a valid token', async () => {
      // Mock getUserByEmail
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'teacher-1', email: 'test@example.com', name: 'Test Teacher' },
              error: null
            })
          })
        })
      });

      const res = await request(app)
        .get('/api/auth/verify-token')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('test@example.com');
    });

    it('should return 401 for missing token', async () => {
      const res = await request(app)
        .get('/api/auth/verify-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/request-reset', () => {
    it('should return success even for non-existent email', async () => {
      // Mock getUserByEmail returning null (first from() call)
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Mock logAuthEvent insert (called even when user doesn't exist)
      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const res = await request(app)
        .post('/api/auth/request-reset')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 400 for missing email', async () => {
      const res = await request(app)
        .post('/api/auth/request-reset')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
