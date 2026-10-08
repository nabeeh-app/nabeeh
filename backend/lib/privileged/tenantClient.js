const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const logger = require('../logger');

function clientConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required for scoped clients');
  }
  return { url, anonKey };
}

function tenantSecret() {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    throw new Error('SUPABASE_JWT_SECRET environment variable is required for scoped clients');
  }
  return secret;
}

function tenantClaims(req) {
  if (!req.user) throw new Error('scopedClient requires an authenticated request');
  const tenantId = req.user.teacherId || req.user.id;
  return {
    sub: req.user.id,
    role: 'authenticated',
    tenant_id: tenantId,
    actor_id: req.user.id,
    actor_role: req.user.role === 'assistant' ? 'assistant' : 'teacher',
    tenantId,
  };
}

// Build a per-request PostgREST client bound to the caller tenant.
// Returns the configured client only. The raw token never leaves this
// module: no return value, no log line, no cookie carries it.
function scopedClient(req) {
  const claims = tenantClaims(req);
  const token = jwt.sign(
    {
      sub: claims.sub,
      role: 'authenticated',
      tenant_id: claims.tenantId,
      actor_id: claims.actor_id,
      actor_role: claims.actor_role,
    },
    tenantSecret(),
    { algorithm: 'HS256', expiresIn: 60 }
  );
  logger.debug('Scoped tenant client minted', { tenantId: claims.tenantId });
  const { url, anonKey } = clientConfig();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

module.exports = { scopedClient, tenantClaims };
