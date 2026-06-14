const { Resend } = require('resend');
const logger = require('./logger');

let resend;

function getClient() {
  if (!resend) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

/**
 * Send an email via Resend
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {string} [options.from] - Sender (defaults to RESEND_FROM_EMAIL)
 * @param {string} [options.idempotencyKey] - Prevents duplicate sends
 * @returns {Object} { success: boolean, data?: { id: string }, error?: string }
 */
async function sendEmail({ to, subject, html, from, idempotencyKey }) {
  if (!process.env.RESEND_API_KEY) {
    logger.warn('RESEND_API_KEY not set, skipping email', { to, subject });
    return { success: false, error: 'Email not configured' };
  }

  const { data, error } = await getClient().emails.send({
    from: from || process.env.RESEND_FROM_EMAIL || 'Nabeeh <noreply@nabeeh.app>',
    to: [to],
    subject,
    html,
    ...(idempotencyKey && { idempotencyKey }),
  });

  if (error) {
    logger.error('Resend email failed', { to, subject, error: error.message });
    return { success: false, error: error.message };
  }

  logger.info('Email sent', { to, subject, id: data?.id });
  return { success: true, data };
}

module.exports = { sendEmail };
