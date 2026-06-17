jest.mock('express-rate-limit', () => () => (req, res, next) => next());

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const mockDbFrom = jest.fn();

jest.mock('../../config/database', () => ({
  supabase: { from: jest.fn() },
  supabaseAdmin: {
    from: mockDbFrom
  }
}));

const TokenService = require('../../lib/auth').TokenService;
const { supabaseAdmin } = require('../../config/database');

describe('Token Revocation', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key-for-testing';
    process.env.JWT_EXPIRES_IN = '24h';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  describe('TokenService.generateToken', () => {
    it('should include jti in the token payload', () => {
      const service = new TokenService();
      const token = service.generateToken({
        id: 'user-1',
        email: 'test@example.com',
        role: 'teacher'
      });

      const decoded = service.verifyToken(token);
      expect(decoded.jti).toBeDefined();
      expect(typeof decoded.jti).toBe('string');
      expect(decoded.jti).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('should generate unique jti for each token', () => {
      const service = new TokenService();
      const token1 = service.generateToken({ id: 'u1', email: 'a@b.com' });
      const token2 = service.generateToken({ id: 'u2', email: 'c@d.com' });

      const decoded1 = service.verifyToken(token1);
      const decoded2 = service.verifyToken(token2);
      expect(decoded1.jti).not.toBe(decoded2.jti);
    });
  });

  describe('TokenService.revokeToken', () => {
    it('should insert jti and expires_at into revoked_tokens table', async () => {
      const service = new TokenService();
      const token = service.generateToken({
        id: 'user-1',
        email: 'test@example.com'
      });

      const insertMock = jest.fn().mockResolvedValue({ data: null, error: null });
      mockDbFrom.mockReturnValue({ insert: insertMock });

      await service.revokeToken(token);

      expect(supabaseAdmin.from).toHaveBeenCalledWith('revoked_tokens');
      expect(insertMock).toHaveBeenCalledTimes(1);
      const insertArg = insertMock.mock.calls[0][0];
      expect(insertArg.jti).toBeDefined();
      expect(insertArg.expires_at).toBeDefined();
    });

    it('should throw if insert fails', async () => {
      const service = new TokenService();
      const token = service.generateToken({
        id: 'user-1',
        email: 'test@example.com'
      });

      const insertMock = jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
      mockDbFrom.mockReturnValue({ insert: insertMock });

      try {
        await service.revokeToken(token);
        throw new Error('should have thrown');
      } catch(e) {
        expect(e.message).toBe('DB error');
      }
    });
  });

  describe('TokenService.isTokenRevoked', () => {
    it('should return true for revoked tokens', async () => {
      const service = new TokenService();
      const maybeSingleMock = jest.fn().mockResolvedValue({ data: { id: 'some-id' }, error: null });
      mockDbFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: maybeSingleMock
          })
        })
      });

      const result = await service.isTokenRevoked('test-jti-123');
      expect(result).toBe(true);
    });

    it('should return false for non-revoked tokens', async () => {
      const service = new TokenService();
      const maybeSingleMock = jest.fn().mockResolvedValue({ data: null, error: null });
      mockDbFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: maybeSingleMock
          })
        })
      });

      const result = await service.isTokenRevoked('non-revoked-jti');
      expect(result).toBe(false);
    });

    it('should throw if query fails', async () => {
      const service = new TokenService();
      const maybeSingleMock = jest.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
      mockDbFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            maybeSingle: maybeSingleMock
          })
        })
      });

      try {
        await service.isTokenRevoked('jti');
        throw new Error('should have thrown');
      } catch(e) {
        expect(e.message).toBe('DB error');
      }
    });
  });
});
