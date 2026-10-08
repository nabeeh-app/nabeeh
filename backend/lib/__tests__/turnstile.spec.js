const { verifyTurnstileToken, isConfigured } = require('../turnstile');

describe('turnstile', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    delete process.env.TURNSTILE_SECRET_KEY;
    global.fetch = jest.fn();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('skips verification when no secret is configured', async () => {
    expect(isConfigured()).toBe(false);
    await expect(verifyTurnstileToken(undefined)).resolves.toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('accepts a token Cloudflare confirms', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    global.fetch.mockResolvedValue({ json: async () => ({ success: true }) });

    await expect(verifyTurnstileToken('token', '1.2.3.4')).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('rejects a token Cloudflare denies', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';
    global.fetch.mockResolvedValue({ json: async () => ({ success: false }) });

    await expect(verifyTurnstileToken('bad', '1.2.3.4')).resolves.toBe(false);
  });

  it('rejects a missing token when configured', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'secret';

    await expect(verifyTurnstileToken(undefined)).resolves.toBe(false);
  });
});
