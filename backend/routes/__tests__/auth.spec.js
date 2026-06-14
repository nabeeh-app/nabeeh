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

const mockAuthenticateUser = jest.fn();
const mockGenerateToken = jest.fn().mockReturnValue('mock-jwt-token');
const mockVerifyToken = jest.fn().mockReturnValue({ user_id: 'teacher-1', email: 'test@example.com' });
const mockGenerateResetToken = jest.fn().mockReturnValue('mock-reset-token');
const mockValidatePasswordStrength = jest.fn().mockReturnValue({ isValid: true, errors: [] });

jest.mock('../../lib/auth', () => ({
  TokenService: jest.fn().mockImplementation(() => ({
    generateToken: mockGenerateToken,
    verifyToken: mockVerifyToken,
    generateResetToken: mockGenerateResetToken
  })),
  AuthService: jest.fn().mockImplementation(() => ({
    passwordService: {
      validatePasswordStrength: mockValidatePasswordStrength,
      hashPassword: jest.fn().mockResolvedValue('hashed-password')
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
const { supabase, supabaseAdmin } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidatePasswordStrength.mockReturnValue({ isValid: true, errors: [] });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new teacher successfully', async () => {
      const mockTeacher = {
        id: 'new-teacher-1',
        email: 'new@example.com',
        name: 'New Teacher',
        phone: null,
        business_name: null,
        subjects: null,
        whatsapp_number: null
      };

      // getUserByEmail now uses supabaseAdmin
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      supabaseAdmin.auth.admin.createUser.mockResolvedValueOnce({
        data: { user: { id: 'new-teacher-1' } },
        error: null
      });

      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockTeacher, error: null })
          })
        })
      });

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
      expect(res.body.data.teacher).toBeDefined();
      expect(res.body.data.teacher.name).toBe('New Teacher');
      expect(res.body.data.teacher.email).toBe('new@example.com');
      expect(res.body.message).toBe('Registration successful');
    });

    it('should reject registration with invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New Teacher',
          email: 'not-an-email',
          password: 'StrongPass123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New Teacher',
          email: 'new@example.com',
          password: 'short'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with missing name', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'new@example.com',
          password: 'StrongPass123!'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 409 for duplicate email', async () => {
      // getUserByEmail now uses supabaseAdmin
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'existing-teacher', email: 'existing@example.com' },
              error: null
            })
          })
        })
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New Teacher',
          email: 'existing@example.com',
          password: 'StrongPass123!'
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Email is already registered');
    });

    it('should rollback auth user if teacher insert fails', async () => {
      // getUserByEmail now uses supabaseAdmin
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      supabaseAdmin.auth.admin.createUser.mockResolvedValueOnce({
        data: { user: { id: 'new-teacher-1' } },
        error: null
      });

      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } })
          })
        })
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New Teacher',
          email: 'new@example.com',
          password: 'StrongPass123!'
        });

      expect(res.status).toBe(500);
      expect(supabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith('new-teacher-1');
    });

    it('should return 500 when createUser throws non-duplicate error', async () => {
      // getUserByEmail now uses supabaseAdmin
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      supabaseAdmin.auth.admin.createUser.mockResolvedValueOnce({
        data: null,
        error: { message: 'Internal auth error' }
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'New Teacher',
          email: 'new@example.com',
          password: 'StrongPass123!'
        });

      expect(res.status).toBe(500);
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

      // Teacher profile query now uses supabaseAdmin
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

      // updateLastLogin now uses supabaseAdmin
      supabaseAdmin.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      // logAuthEvent uses supabaseAdmin
      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBe('mock-jwt-token');
      expect(res.body.data.teacher).toBeDefined();
      expect(res.body.data.teacher.name).toBe('Test Teacher');
    });

    it('should reject login with invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-valid', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject login with missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 for wrong password', async () => {
      mockAuthenticateUser.mockResolvedValueOnce({
        success: false,
        message: 'Invalid credentials',
        messageAr: 'بيانات الدخول غير صحيحة'
      });

      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('should return 500 when auth service throws', async () => {
      mockAuthenticateUser.mockRejectedValueOnce(new Error('Service unavailable'));

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password123' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      mockVerifyToken.mockReturnValueOnce({ user_id: 'teacher-1', email: 'test@example.com' });
      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Logged out successfully');
    });

    it('should logout gracefully even with invalid token', async () => {
      mockVerifyToken.mockImplementationOnce(() => { throw new Error('Invalid token'); });

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should logout without token', async () => {
      const res = await request(app)
        .post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/auth/verify-token', () => {
    it('should verify a valid token', async () => {
      // getUserByEmail now uses supabaseAdmin
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
      expect(res.body.data.name).toBe('Test Teacher');
      expect(res.body.data.role).toBe('teacher');
    });

    it('should return 401 for missing token', async () => {
      const res = await request(app)
        .get('/api/auth/verify-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 for invalid token', async () => {
      mockVerifyToken.mockImplementationOnce(() => { throw new Error('Invalid token'); });

      const res = await request(app)
        .get('/api/auth/verify-token')
        .set('Authorization', 'Bearer bad-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 when user not found in DB', async () => {
      // getUserByEmail now uses supabaseAdmin
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      const res = await request(app)
        .get('/api/auth/verify-token')
        .set('Authorization', 'Bearer mock-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('User not found');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current teacher profile', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'teacher-1',
                email: 'test@example.com',
                name: 'Test Teacher',
                phone: '+201234567890',
                business_name: 'My School',
                subjects: ['Math'],
                whatsapp_number: '+201234567890'
              },
              error: null
            })
          })
        })
      });

      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Test Teacher');
      expect(res.body.data.email).toBe('test@example.com');
      expect(res.body.data.phone).toBe('+201234567890');
      expect(res.body.data.role).toBe('teacher');
    });

    it('should return 404 when teacher not found', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
          })
        })
      });

      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Teacher not found');
    });
  });

  describe('PUT /api/auth/profile', () => {
    it('should update profile fields', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'teacher-1',
                  email: 'test@example.com',
                  name: 'Updated Name',
                  phone: '+201234567890',
                  business_name: null,
                  subjects: null,
                  whatsapp_number: null
                },
                error: null
              })
            })
          })
        })
      });

      const res = await request(app)
        .put('/api/auth/profile')
        .send({ name: 'Updated Name', phone: '+201234567890' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.message).toBe('Profile updated successfully');
    });

    it('should return 400 for empty body', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid phone format', async () => {
      const res = await request(app)
        .put('/api/auth/profile')
        .send({ phone: 'not-a-phone' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should only update allowed fields, ignore extras', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: {
                  id: 'teacher-1',
                  email: 'test@example.com',
                  name: 'Updated',
                  phone: null,
                  business_name: null,
                  subjects: null,
                  whatsapp_number: null
                },
                error: null
              })
            })
          })
        })
      });

      await request(app)
        .put('/api/auth/profile')
        .send({ name: 'Updated', email: 'hacker@evil.com', role: 'admin' });

      const updateCall = supabaseAdmin.from.mock.results[0].value.update.mock.calls[0][0];
      expect(updateCall.name).toBe('Updated');
      expect(updateCall.email).toBeUndefined();
      expect(updateCall.role).toBeUndefined();
    });

    it('should return 400 when DB update fails', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Update failed' }
              })
            })
          })
        })
      });

      const res = await request(app)
        .put('/api/auth/profile')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/request-reset', () => {
    it('should return success even for non-existent email', async () => {
      // getUserByEmail now uses supabaseAdmin
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      const res = await request(app)
        .post('/api/auth/request-reset')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should generate and store reset token for existing user', async () => {
      // getUserByEmail now uses supabaseAdmin
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'teacher-1', email: 'test@example.com' },
              error: null
            })
          })
        })
      });

      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      const res = await request(app)
        .post('/api/auth/request-reset')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/request-reset')
        .send({ email: 'not-valid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 for missing email', async () => {
      const res = await request(app)
        .post('/api/auth/request-reset')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/reset/:token', () => {
    it('should validate a valid reset token', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'r1',
                teacher_id: 'teacher-1',
                expires_at: new Date(Date.now() + 3600000).toISOString(),
                used: false
              },
              error: null
            })
          })
        })
      });

      const res = await request(app)
        .get('/api/auth/reset/valid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Reset token is valid');
    });

    it('should reject non-existent token', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
          })
        })
      });

      const res = await request(app)
        .get('/api/auth/reset/nonexistent-token');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid reset token');
    });

    it('should reject used token', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'r1',
                teacher_id: 'teacher-1',
                expires_at: new Date(Date.now() + 3600000).toISOString(),
                used: true
              },
              error: null
            })
          })
        })
      });

      const res = await request(app)
        .get('/api/auth/reset/used-token');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Reset token has already been used');
    });

    it('should reject expired token', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'r1',
                teacher_id: 'teacher-1',
                expires_at: new Date(Date.now() - 3600000).toISOString(),
                used: false
              },
              error: null
            })
          })
        })
      });

      const res = await request(app)
        .get('/api/auth/reset/expired-token');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Reset token has expired');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'r1',
                teacher_id: 'teacher-1',
                expires_at: new Date(Date.now() + 3600000).toISOString(),
                used: false
              },
              error: null
            })
          })
        })
      });

      supabaseAdmin.auth.admin.updateUserById.mockResolvedValueOnce({ error: null });

      supabaseAdmin.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      });

      supabaseAdmin.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null })
      });

      mockValidatePasswordStrength.mockReturnValueOnce({ isValid: true, errors: [] });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'mock-reset-token', newPassword: 'NewStrong123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Password has been reset successfully');
    });

    it('should return 400 for weak password', async () => {
      mockValidatePasswordStrength.mockReturnValueOnce({
        isValid: false,
        errors: ['Password must contain at least one uppercase letter']
      });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'mock-reset-token', newPassword: 'alllowercase' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for expired reset token', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'r1',
                teacher_id: 'teacher-1',
                expires_at: new Date(Date.now() - 3600000).toISOString(),
                used: false
              },
              error: null
            })
          })
        })
      });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'expired-token', newPassword: 'NewStrong123!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid or expired reset token');
    });

    it('should return 400 for used reset token', async () => {
      mockValidatePasswordStrength.mockReturnValueOnce({ isValid: true, errors: [] });

      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'r1',
                teacher_id: 'teacher-1',
                expires_at: new Date(Date.now() + 3600000).toISOString(),
                used: true
              },
              error: null
            })
          })
        })
      });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'used-token', newPassword: 'NewStrong123!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 when password update fails', async () => {
      supabaseAdmin.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'r1',
                teacher_id: 'teacher-1',
                expires_at: new Date(Date.now() + 3600000).toISOString(),
                used: false
              },
              error: null
            })
          })
        })
      });

      supabaseAdmin.auth.admin.updateUserById.mockResolvedValueOnce({ error: { message: 'Update failed' } });

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'mock-reset-token', newPassword: 'NewStrong123!' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should reject missing token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ newPassword: 'NewStrong123!' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing newPassword', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'some-token' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
