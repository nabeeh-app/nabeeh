// Audit-gap proofs: login captcha gate + anonymous-endpoint limiters.
// NODE_ENV=production BEFORE requires so the prod-only limiters engage.
// NOTE: loginLimiter is 20/5min per IP in prod — this file stays under 14
// login POSTs total. Add no more without raising the budget or resetting
// the rate-limit store.
process.env.NODE_ENV = 'production';

const request = require('supertest');
const express = require('express');

jest.mock('../../config/database', () => ({
  supabase: { from: jest.fn() },
  supabaseAdmin: { from: jest.fn() }
}));

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true })
}));

jest.mock('../../lib/emailTemplates', () => ({
  getWelcomeTemplate: jest.fn().mockReturnValue({ subject: 's', html: 'h' }),
  getPasswordResetTemplate: jest.fn().mockReturnValue({ subject: 's', html: 'h' }),
  getAssistantInviteTemplate: jest.fn().mockReturnValue({ subject: 's', html: 'h' })
}));

jest.mock('../../lib/auditLog', () => ({
  logAudit: jest.fn()
}));

jest.mock('../../lib/sessionManager', () => ({
  getSession: jest.fn().mockReturnValue(null)
}));

const mockAuthenticateUser = jest.fn();
const mockHashToken = jest.fn().mockImplementation((t) => 'hashed-' + t);

jest.mock('../../lib/auth', () => ({
  TokenService: jest.fn().mockImplementation(() => ({
    generateToken: jest.fn().mockReturnValue('mock-jwt-token'),
    verifyToken: jest.fn().mockReturnValue({ user_id: 'teacher-1' }),
    generateResetToken: jest.fn().mockReturnValue('mock-reset-token'),
    hashToken: mockHashToken,
    revokeToken: jest.fn().mockResolvedValue()
  })),
  AuthService: jest.fn().mockImplementation(() => ({
    passwordService: {
      validatePasswordStrength: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
      hashPassword: jest.fn().mockResolvedValue('hashed-password')
    },
    tokenService: {
      generateToken: jest.fn().mockReturnValue('mock-jwt-token'),
      verifyToken: jest.fn().mockReturnValue({ user_id: 'teacher-1' }),
      generateResetToken: jest.fn().mockReturnValue('mock-reset-token'),
      hashToken: mockHashToken,
      revokeToken: jest.fn().mockResolvedValue()
    },
    authenticateUser: mockAuthenticateUser
  }))
}));

// Real middleware/security (failure tracker), real turnstile helper,
// real express-rate-limit — the audit gaps live in exactly these.
const { supabaseAdmin } = require('../../config/database');
const { resetLoginFailures } = require('../../middleware/security');
const authRouter = require('../auth');
const assistantsRouter = require('../assistants');

const cannedSingle = (table) => {
  if (table === 'teachers') {
    return { data: { id: 'teacher-1', name: 'T', email: 't@x.com' }, error: null };
  }
  if (table === 'password_reset_tokens') {
    return { data: null, error: { message: 'No rows' } };
  }
  return { data: null, error: null };
};

supabaseAdmin.from.mockImplementation((table) => {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    order: jest.fn(() => builder),
    limit: jest.fn(() => builder),
    update: jest.fn(() => builder),
    single: jest.fn(async () => cannedSingle(table)),
    insert: jest.fn(async () => ({ error: null })),
    // update().eq() is awaited directly — resolve the terminal await.
    then: (resolve) => Promise.resolve({ error: null }).then(resolve)
  };
  return builder;
});

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/assistants', assistantsRouter);

const loginAs = (body) => request(app).post('/api/auth/login').send(body);

describe('P1 login captcha gate', () => {
  const OLD_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
    resetLoginFailures();
    delete process.env.TURNSTILE_SECRET_KEY;
    process.env.NODE_ENV = 'production';
    mockAuthenticateUser.mockResolvedValue({ success: false, message: 'Invalid credentials' });
  });

  afterAll(() => {
    process.env.NODE_ENV = OLD_ENV;
  });

  it('3rd consecutive failure flags captchaRequired', async () => {
    const first = await loginAs({ email: 'a@x.com', password: 'wrong1' });
    expect(first.status).toBe(401);
    expect(first.body.captchaRequired).toBeUndefined();

    const second = await loginAs({ email: 'a@x.com', password: 'wrong2' });
    expect(second.status).toBe(401);
    expect(second.body.captchaRequired).toBeUndefined();

    const third = await loginAs({ email: 'a@x.com', password: 'wrong3' });
    expect(third.status).toBe(401);
    expect(third.body.captchaRequired).toBe(true);
    expect(third.body.code).toBe('CAPTCHA_REQUIRED');
  });

  it('locked-out attempt without captcha gets 403 and never checks credentials', async () => {
    await loginAs({ email: 'a@x.com', password: 'wrong1' });
    await loginAs({ email: 'a@x.com', password: 'wrong2' });
    await loginAs({ email: 'a@x.com', password: 'wrong3' });
    const callsAfterLockout = mockAuthenticateUser.mock.calls.length;

    const blocked = await loginAs({ email: 'a@x.com', password: 'wrong4' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('CAPTCHA_REQUIRED');
    expect(mockAuthenticateUser.mock.calls.length).toBe(callsAfterLockout);
  });

  it('valid captcha + good creds pass after lockout and clear the counter', async () => {
    process.env.NODE_ENV = 'test'; // dev-skip: unconfigured secret passes
    await loginAs({ email: 'a@x.com', password: 'wrong1' });
    await loginAs({ email: 'a@x.com', password: 'wrong2' });
    await loginAs({ email: 'a@x.com', password: 'wrong3' });

    mockAuthenticateUser.mockResolvedValueOnce({
      success: true,
      user: { id: 'teacher-1' },
      token: 'tok'
    });
    const ok = await loginAs({ email: 'a@x.com', password: 'right', turnstileToken: 'any' });
    expect(ok.status).toBe(200);

    const fresh = await loginAs({ email: 'a@x.com', password: 'wrong-again' });
    expect(fresh.status).toBe(401);
    expect(fresh.body.captchaRequired).toBeUndefined();
  });

  it('prod without a secret fails closed', async () => {
    await loginAs({ email: 'a@x.com', password: 'wrong1' });
    await loginAs({ email: 'a@x.com', password: 'wrong2' });
    await loginAs({ email: 'a@x.com', password: 'wrong3' });

    const res = await loginAs({ email: 'a@x.com', password: 'right', turnstileToken: 'any' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CAPTCHA_REQUIRED');
  });
});

describe('P2 anonymous-endpoint limiters', () => {
  it('GET reset/:token is throttled by resetLimiter (3/hr)', async () => {
    for (let i = 0; i < 3; i++) {
      const r = await request(app).get('/api/auth/reset/probe-token');
      expect(r.status).toBe(400);
    }
    const limited = await request(app).get('/api/auth/reset/probe-token');
    expect(limited.status).toBe(429);
  });

  it('GET invites/:token is throttled (20/15min)', async () => {
    for (let i = 0; i < 20; i++) {
      const r = await request(app).get('/api/assistants/invites/probe-token');
      expect(r.status).toBe(404);
    }
    const limited = await request(app).get('/api/assistants/invites/probe-token');
    expect(limited.status).toBe(429);
  });

  it('GET verify-token answers single checks and throttles floods', async () => {
    const single = await request(app).get('/api/auth/verify-token');
    expect(single.status).toBe(401);

    let last = single.status;
    // authLimiter allows 50/15min; one already spent above.
    for (let i = 0; i < 50; i++) {
      last = (await request(app).get('/api/auth/verify-token')).status;
    }
    expect(last).toBe(429);
  });
});
