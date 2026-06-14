process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.JWT_EXPIRES_IN = '24h';

jest.mock('../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const { TokenService, PasswordService, AuthService } = require('../auth');

describe('PasswordService', () => {
  const passwordService = new PasswordService();

  describe('validatePasswordStrength', () => {
    it('should reject password shorter than 8 characters', () => {
      const result = passwordService.validatePasswordStrength('Ab1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must be at least 8 characters');
    });

    it('should reject password without uppercase', () => {
      const result = passwordService.validatePasswordStrength('alllowercase1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const result = passwordService.validatePasswordStrength('ALLUPPERCASE1');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without number', () => {
      const result = passwordService.validatePasswordStrength('NoNumbersHere');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must contain at least one number');
    });

    it('should reject password longer than 128 characters', () => {
      const longPassword = 'A' + 'a'.repeat(127) + '1';
      const result = passwordService.validatePasswordStrength(longPassword);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Password must not exceed 128 characters');
    });

    it('should accept a strong password', () => {
      const result = passwordService.validatePasswordStrength('StrongPass123!');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should report multiple errors at once', () => {
      const result = passwordService.validatePasswordStrength('weak');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('TokenService', () => {
  const tokenService = new TokenService();

  describe('generateToken', () => {
    it('should return a string token', () => {
      const token = tokenService.generateToken({ id: 'u1', email: 'test@example.com', role: 'teacher' });
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });
  });

  describe('verifyToken', () => {
    it('should verify a valid token and return payload', () => {
      const payload = { id: 'u1', email: 'test@example.com', role: 'teacher' };
      const token = tokenService.generateToken(payload);
      const decoded = tokenService.verifyToken(token);

      expect(decoded.user_id).toBe('u1');
      expect(decoded.email).toBe('test@example.com');
      expect(decoded.role).toBe('teacher');
      expect(decoded.iss).toBe('nabeeh-auth');
      expect(decoded.aud).toBe('nabeeh-app');
    });

    it('should throw on invalid token', () => {
      expect(() => tokenService.verifyToken('invalid-token')).toThrow('Invalid token');
    });

    it('should throw on expired token', () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { user_id: 'u1', email: 'test@example.com' },
        process.env.JWT_SECRET,
        { expiresIn: '-1s', issuer: 'nabeeh-auth', audience: 'nabeeh-app' }
      );

      expect(() => tokenService.verifyToken(token)).toThrow('Invalid token');
    });

    it('should throw on wrong secret', () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { user_id: 'u1', email: 'test@example.com' },
        'wrong-secret',
        { issuer: 'nabeeh-auth', audience: 'nabeeh-app' }
      );

      expect(() => tokenService.verifyToken(token)).toThrow('Invalid token');
    });
  });

  describe('generateResetToken', () => {
    it('should return a 64-char hex string', () => {
      const token = tokenService.generateResetToken();
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique tokens each call', () => {
      const t1 = tokenService.generateResetToken();
      const t2 = tokenService.generateResetToken();
      expect(t1).not.toBe(t2);
    });
  });
});

describe('AuthService', () => {
  const authService = new AuthService();

  it('should have tokenService and passwordService', () => {
    expect(authService.tokenService).toBeInstanceOf(TokenService);
    expect(authService.passwordService).toBeInstanceOf(PasswordService);
  });

  describe('authenticateUser', () => {
    it('should return success on valid credentials', async () => {
      const mockSupabase = {
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: {
              user: {
                id: 'u1',
                email: 'test@example.com',
                user_metadata: { name: 'Test', role: 'teacher' }
              }
            },
            error: null
          })
        }
      };

      const result = await authService.authenticateUser('test@example.com', 'password', mockSupabase);

      expect(result.success).toBe(true);
      expect(result.user.id).toBe('u1');
      expect(result.token).toBeDefined();
      expect(result.message).toBe('Login successful');
    });

    it('should return failure on invalid credentials', async () => {
      const mockSupabase = {
        auth: {
          signInWithPassword: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Invalid login credentials' }
          })
        }
      };

      const result = await authService.authenticateUser('test@example.com', 'wrong', mockSupabase);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid credentials');
    });

    it('should handle exceptions gracefully', async () => {
      const mockSupabase = {
        auth: {
          signInWithPassword: jest.fn().mockRejectedValue(new Error('Network error'))
        }
      };

      const result = await authService.authenticateUser('test@example.com', 'password', mockSupabase);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Authentication failed');
    });
  });
});
