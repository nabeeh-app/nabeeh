-- WhatsApp auth state tables for production-grade Supabase-backed auth
-- Replaces useMultiFileAuthState which is not suitable for production

CREATE TABLE IF NOT EXISTS whatsapp_auth_creds (
  id TEXT PRIMARY KEY DEFAULT 'default',
  creds JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_auth_keys (
  type TEXT NOT NULL,
  id TEXT NOT NULL,
  data JSONB NOT NULL,
  PRIMARY KEY (type, id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_auth_keys_type ON whatsapp_auth_keys(type);

-- Enable RLS
ALTER TABLE whatsapp_auth_creds ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_auth_keys ENABLE ROW LEVEL SECURITY;

-- Only service role can access (backend only)
CREATE POLICY "Service role only" ON whatsapp_auth_creds FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role only" ON whatsapp_auth_keys FOR ALL USING (auth.role() = 'service_role');
