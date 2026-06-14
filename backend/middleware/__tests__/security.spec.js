const logger = require('../../lib/logger');

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const {
  sanitizeInput,
  securityHeaders,
  securityLogger,
  apiLimiter,
  authLimiter,
  whatsappLimiter
} = require('../security');

function runMiddleware(middleware, req, res = {}) {
  return new Promise((resolve, reject) => {
    const mockRes = {
      statusCode: 200,
      on: jest.fn(),
      getHeader: res.getHeader || jest.fn(),
      ...res
    };
    middleware(req, mockRes, (err) => {
      if (err) reject(err);
      else resolve({ req, res: mockRes });
    });
  });
}

describe('sanitizeInput', () => {
  it('should strip script tags from body strings', async () => {
    const req = { body: { name: '<script>alert("xss")</script>John' }, query: {} };
    const { req: result } = await runMiddleware(sanitizeInput, req);
    expect(result.body.name).toBe('John');
  });

  it('should strip javascript: protocol from body strings', async () => {
    const req = { body: { url: 'javascript:alert(1)' }, query: {} };
    const { req: result } = await runMiddleware(sanitizeInput, req);
    expect(result.body.url).toBe('alert(1)');
  });

  it('should strip onclick handlers from body strings', async () => {
    const req = { body: { info: 'onclick=alert(1) hello' }, query: {} };
    const { req: result } = await runMiddleware(sanitizeInput, req);
    expect(result.body.info).toBe('hello');
  });

  it('should strip script tags from query strings', async () => {
    const req = { body: {}, query: { search: '<script>evil</script>query' } };
    const { req: result } = await runMiddleware(sanitizeInput, req);
    expect(result.query.search).toBe('query');
  });

  it('should not modify non-string values', async () => {
    const req = { body: { count: 42, active: true, nested: { key: 'val' } }, query: {} };
    const { req: result } = await runMiddleware(sanitizeInput, req);
    expect(result.body.count).toBe(42);
    expect(result.body.active).toBe(true);
  });

  it('should trim whitespace from sanitized strings', async () => {
    const req = { body: { name: '  <script>x</script>  ' }, query: {} };
    const { req: result } = await runMiddleware(sanitizeInput, req);
    expect(result.body.name).toBe('');
  });

  it('should handle empty body', async () => {
    const req = { query: {} };
    const { req: result } = await runMiddleware(sanitizeInput, req);
    expect(result).toBeDefined();
  });

  it('should handle nested objects in body', async () => {
    const req = {
      body: { nested: { deep: '<script>x</script>safe' } },
      query: {}
    };
    const { req: result } = await runMiddleware(sanitizeInput, req);
    expect(result.body.nested.deep).toBe('<script>x</script>safe');
  });

  it('should strip onmouseover and other event handlers', async () => {
    const req = {
      body: { field: 'onmouseover=evil() text' },
      query: {}
    };
    const { req: result } = await runMiddleware(sanitizeInput, req);
    expect(result.body.field).toBe('text');
  });

  it('should handle multiple body keys at once', async () => {
    const req = {
      body: {
        name: '<script>a</script>Ahmed',
        bio: 'onclick=hack() bio',
        age: 25
      },
      query: {}
    };
    const { req: result } = await runMiddleware(sanitizeInput, req);
    expect(result.body.name).toBe('Ahmed');
    expect(result.body.bio).toBe('bio');
    expect(result.body.age).toBe(25);
  });
});

describe('securityHeaders', () => {
  it('should be a middleware function', () => {
    expect(typeof securityHeaders).toBe('function');
  });

  it('should set security headers on response', (done) => {
    const req = {};
    const res = {
      getHeader: jest.fn(),
      setHeader: jest.fn(),
      removeHeader: jest.fn()
    };

    securityHeaders(req, res, () => {
      expect(res.setHeader).toHaveBeenCalled();
      done();
    });
  });
});

describe('securityLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call next() immediately', () => {
    const req = {};
    const res = { on: jest.fn() };
    const next = jest.fn();

    securityLogger(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should register a finish listener on response', () => {
    const req = {};
    const res = { on: jest.fn() };
    const next = jest.fn();

    securityLogger(req, res, next);
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('should log warning for 4xx status codes', () => {
    const req = { method: 'GET', originalUrl: '/test', ip: '127.0.0.1', get: jest.fn().mockReturnValue('test-agent') };
    const finishHandler = jest.fn();
    const res = { on: jest.fn((event, cb) => { if (event === 'finish') finishHandler(cb); }), statusCode: 404 };

    securityLogger(req, res, jest.fn());

    const finishCb = finishHandler.mock.calls[0][0];
    finishCb();

    expect(logger.warn).toHaveBeenCalledWith(
      'Security Warning',
      expect.objectContaining({ statusCode: 404 })
    );
  });

  it('should log slow requests exceeding 5000ms', () => {
    const req = { method: 'POST', originalUrl: '/slow', ip: '127.0.0.1', get: jest.fn().mockReturnValue('agent') };
    const finishHandler = jest.fn();
    const res = { on: jest.fn((event, cb) => { if (event === 'finish') finishHandler(cb); }), statusCode: 200 };

    const originalDateNow = Date.now;
    let callCount = 0;
    Date.now = jest.fn(() => {
      callCount++;
      return callCount === 1 ? 1000 : 7000;
    });

    securityLogger(req, res, jest.fn());
    const finishCb = finishHandler.mock.calls[0][0];
    finishCb();

    expect(logger.warn).toHaveBeenCalledWith(
      'Slow Request',
      expect.objectContaining({ duration: expect.stringContaining('ms') })
    );

    Date.now = originalDateNow;
  });

  it('should NOT log for successful fast requests', () => {
    const req = { method: 'GET', originalUrl: '/ok', ip: '127.0.0.1', get: jest.fn().mockReturnValue('agent') };
    const finishHandler = jest.fn();
    const res = { on: jest.fn((event, cb) => { if (event === 'finish') finishHandler(cb); }), statusCode: 200 };

    const originalDateNow = Date.now;
    let callCount = 0;
    Date.now = jest.fn(() => {
      callCount++;
      return callCount === 1 ? 1000 : 1050;
    });

    securityLogger(req, res, jest.fn());
    const finishCb = finishHandler.mock.calls[0][0];
    finishCb();

    expect(logger.warn).not.toHaveBeenCalled();
    Date.now = originalDateNow;
  });
});

describe('rate limiters', () => {
  it('apiLimiter should be a middleware function', () => {
    expect(typeof apiLimiter).toBe('function');
  });

  it('authLimiter should be a middleware function', () => {
    expect(typeof authLimiter).toBe('function');
  });

  it('whatsappLimiter should be a middleware function', () => {
    expect(typeof whatsappLimiter).toBe('function');
  });

  it('limiters should pass through in development mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const req = {};
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    apiLimiter(req, res, next);
    expect(next).toHaveBeenCalled();

    authLimiter(req, res, jest.fn());
    whatsappLimiter(req, res, jest.fn());

    process.env.NODE_ENV = originalEnv;
  });
});
