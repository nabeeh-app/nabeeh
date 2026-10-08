const jwt = require('jsonwebtoken');

process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon-key';

const captured = {};
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn((url, key, opts) => {
    captured.headers = opts.global.headers;
    return { __scoped: true };
  })
}));

describe('tenantClient', () => {
  const OLD_ENV = process.env.SUPABASE_JWT_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPABASE_JWT_SECRET = 'unit-test-legacy-secret';
  });

  afterAll(() => {
    if (OLD_ENV === undefined) delete process.env.SUPABASE_JWT_SECRET;
    else process.env.SUPABASE_JWT_SECRET = OLD_ENV;
  });

  function mintedToken() {
    const header = captured.headers.Authorization.replace('Bearer ', '');
    return jwt.verify(header, 'unit-test-legacy-secret', { algorithms: ['HS256'] });
  }

  it('mints owner tenant for teachers', () => {
    const { scopedClient } = require('../tenantClient');
    const client = scopedClient({ user: { id: 't1', role: 'teacher', teacherId: 't1' } });
    expect(client.__scoped).toBe(true);
    const claims = mintedToken();
    expect(claims.tenant_id).toBe('t1');
    expect(claims.actor_role).toBe('teacher');
    expect(claims.role).toBe('authenticated');
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(60);
  });

  it('mints owner tenant for assistants with actor separation', () => {
    const { scopedClient } = require('../tenantClient');
    scopedClient({ user: { id: 'a9', role: 'assistant', teacherId: 'owner-1' } });
    const claims = mintedToken();
    expect(claims.tenant_id).toBe('owner-1');
    expect(claims.actor_id).toBe('a9');
    expect(claims.actor_role).toBe('assistant');
  });

  it('throws without an authenticated request', () => {
    const { scopedClient } = require('../tenantClient');
    expect(() => scopedClient({})).toThrow(/authenticated request/);
  });

  it('throws when the secret is missing', () => {
    delete process.env.SUPABASE_JWT_SECRET;
    const { scopedClient } = require('../tenantClient');
    expect(() => scopedClient({ user: { id: 't1', teacherId: 't1' } })).toThrow(/SUPABASE_JWT_SECRET/);
  });
});
