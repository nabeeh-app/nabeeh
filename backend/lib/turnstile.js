const logger = require('./logger');

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

const isConfigured = () => Boolean(process.env.TURNSTILE_SECRET_KEY);

/**
 * Verify a Cloudflare Turnstile token with the siteverify API.
 * Returns true when verification passes, or when no secret is configured
 * (local development without captcha). Callers in production must set
 * TURNSTILE_SECRET_KEY, otherwise bots walk through an open door.
 */
async function verifyTurnstileToken(token, remoteIp) {
  if (!isConfigured()) {
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
