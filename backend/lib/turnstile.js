const logger = require('./logger');

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const isConfigured = () => Boolean(process.env.TURNSTILE_SECRET_KEY);

/**
 * Verify a Cloudflare Turnstile token with the siteverify API.
 * Fail closed in production: a missing secret rejects registration
 * instead of waving bots through. Local development without a secret
 * still skips the check so contributors need no Cloudflare account.
 */
async function verifyTurnstileToken(token, remoteIp) {
  if (!isConfigured()) {
    if (process.env.NODE_ENV === 'production') {
      logger.error('Turnstile secret missing in production, rejecting registration');
      return false;
    }
    logger.warn('Turnstile secret missing, captcha check skipped');
    return true;
  }

  if (!token) return false;

  try {
    const body = new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: token
    });
    if (remoteIp) body.append('remoteip', remoteIp);

    const res = await fetch(VERIFY_URL, { method: 'POST', body });
    const data = await res.json();
    return data.success === true;
  } catch (error) {
    logger.error('Turnstile verification failed', { error: error.message });
    return false;
  }
}

module.exports = { verifyTurnstileToken, isConfigured };
