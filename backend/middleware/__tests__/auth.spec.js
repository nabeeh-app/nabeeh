process.env.JWT_SECRET = 'test-secret-for-middleware';

jest.mock('../../config/database', () => ({
  supabaseAdmin: {
    from: jest.fn()
  }
}));

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const jwt = require('jsonwebtoken');
const { authenticateToken, requireRole, requireTeacherOwnership, requirePermission } = require('../auth');

const { supabaseAdmin } = require('../../config/database');

function createMockReq(token) {
  return {
    headers: { authorization: token ? `Bearer ${token}` : undefined },
    params: {},
    body: {},
    query: {}
  };
}

function createMockRes() {
  const res = {
    statusCode: null,
    body: null,
    status: jest.fn().mockImplementation((code) => { res.statusCode = code; return res; }),
    json: jest.fn().mockImplementation((data) => { res.body = data; return res; })
  };
  return res;
}

function generateToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '1h',
    issuer: 'nabeeh-auth',
    audience: 'nabeeh-app'
  });
}

describe('authenticateToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should set req.user and call next for valid token', async () => {
    const token = generateToken({ user_id: 'teacher-1', email: 't@test.com', role: 'teacher' });

    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'teacher-1', email: 't@test.com', role: 'teacher', is_active: true },
            error: null
          })
        })
      })
    });

    const req = createMockReq(token);
    const res = createMockRes();
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user.id).toBe('teacher-1');
  });

  it('should return 401 for missing token', async () => {
    const req = createMockReq(null);
    const res = createMockRes();
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Access token is required');
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for expired token', async () => {
    const token = jwt.sign(
      { user_id: 'teacher-1', email: 't@test.com' },
      process.env.JWT_SECRET,
      { expiresIn: '-1s', issuer: 'nabeeh-auth', audience: 'nabeeh-app' }
    );

    const req = createMockReq(token);
    const res = createMockRes();
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('expired');
  });

  it('should return 401 for invalid token signature', async () => {
    const token = jwt.sign(
      { user_id: 'teacher-1', email: 't@test.com' },
      'wrong-secret',
      { issuer: 'nabeeh-auth', audience: 'nabeeh-app' }
    );

    const req = createMockReq(token);
    const res = createMockRes();
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(res.statusCode).toBe(401);
  });

  it('should return 401 if user not found in database', async () => {
    const token = generateToken({ user_id: 'teacher-1', email: 't@test.com', role: 'teacher' });

    // Mock both teacher and assistant queries to return not found
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === 'teachers') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        };
      }
      if (table === 'teacher_assistants') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          })
        };
      }
      return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: null, error: null }) }) }) };
    });

    const req = createMockReq(token);
    const res = createMockRes();
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('user not found');
  });

  it('should return 401 if user is inactive', async () => {
    const token = generateToken({ user_id: 'teacher-1', email: 't@test.com', role: 'teacher' });

    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'teacher-1', email: 't@test.com', role: 'teacher', is_active: false },
            error: null
          })
        })
      })
    });

    const req = createMockReq(token);
    const res = createMockRes();
    const next = jest.fn();

    await authenticateToken(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body.message).toContain('deactivated');
  });
});

describe('requireRole', () => {
  it('should call next if user has allowed role', () => {
    const middleware = requireRole('teacher');
    const req = { user: { role: 'teacher' } };
    const res = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 403 if user lacks role', () => {
    const middleware = requireRole('admin');
    const req = { user: { role: 'teacher' } };
    const res = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.message).toBe('Insufficient permissions');
    expect(next).not.toHaveBeenCalled();
  });

  it('should accept array of roles', () => {
    const middleware = requireRole(['admin', 'teacher']);
    const req = { user: { role: 'teacher' } };
    const res = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 401 if no user on request', () => {
    const middleware = requireRole('teacher');
    const req = {};
    const res = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
  });
});

describe('requireTeacherOwnership', () => {
  it('should call next if teacher accesses own data', () => {
    const req = { user: { id: 't1', role: 'teacher' }, params: { teacherId: 't1' } };
    const res = createMockRes();
    const next = jest.fn();

    requireTeacherOwnership(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 403 if teacher accesses other teacher data', () => {
    const req = { user: { id: 't1', role: 'teacher' }, params: { teacherId: 't2' } };
    const res = createMockRes();
    const next = jest.fn();

    requireTeacherOwnership(req, res, next);

    expect(res.statusCode).toBe(403);
  });

  it('should allow admin to access any teacher data', () => {
    const req = { user: { id: 'admin1', role: 'admin' }, params: { teacherId: 't2' } };
    const res = createMockRes();
    const next = jest.fn();

    requireTeacherOwnership(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 401 if no user on request', () => {
    const req = { params: {} };
    const res = createMockRes();
    const next = jest.fn();

    requireTeacherOwnership(req, res, next);

    expect(res.statusCode).toBe(401);
  });
});

describe('requirePermission', () => {
  it('should call next for teacher regardless of permissions', () => {
    const middleware = requirePermission('manage_grades');
    const req = { user: { id: 't1', role: 'teacher', permissions: {} } };
    const res = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  it('should call next for admin regardless of permissions', () => {
    const middleware = requirePermission('manage_grades');
    const req = { user: { id: 'a1', role: 'admin', permissions: {} } };
    const res = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should call next for assistant with the required permission', () => {
    const middleware = requirePermission('manage_attendance');
    const req = {
      user: {
        id: 'asst-1',
        role: 'assistant',
        permissions: { manage_attendance: true, manage_grades: false }
      }
    };
    const res = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 403 for assistant missing the required permission', () => {
    const middleware = requirePermission('manage_grades');
    const req = {
      user: {
        id: 'asst-1',
        role: 'assistant',
        permissions: { manage_attendance: true, manage_grades: false }
      }
    };
    const res = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe('Insufficient permissions');
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 for assistant with empty permissions', () => {
    const middleware = requirePermission('send_whatsapp');
    const req = {
      user: { id: 'asst-1', role: 'assistant', permissions: {} }
    };
    const res = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should require ALL permissions when array is passed', () => {
    const middleware = requirePermission(['manage_grades', 'manage_attendance']);
    const req = {
      user: {
        id: 'asst-1',
        role: 'assistant',
        permissions: { manage_grades: true, manage_attendance: false }
      }
    };
    const res = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next for assistant when all array permissions are present', () => {
    const middleware = requirePermission(['manage_grades', 'manage_attendance']);
    const req = {
      user: {
        id: 'asst-1',
        role: 'assistant',
        permissions: { manage_grades: true, manage_attendance: true }
      }
    };
    const res = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should return 401 if no user on request', () => {
    const middleware = requirePermission('manage_grades');
    const req = {};
    const res = createMockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
