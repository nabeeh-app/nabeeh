-- Migration 015: WhatsApp Multi-Session Support
-- Adds teacher_id to auth tables for per-teacher session isolation
-- Creates whatsapp_sessions table for session lifecycle management

-- 1. Add teacher_id column to whatsapp_auth_creds
-- Uses IF NOT EXISTS for idempotency
DO $$ BEGIN
  ALTER TABLE whatsapp_auth_creds
    ADD COLUMN teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Add teacher_id column to whatsapp_auth_keys
DO $$ BEGIN
  ALTER TABLE whatsapp_auth_keys
    ADD COLUMN teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 3. Create whatsapp_sessions table for tracking active sessions
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID UNIQUE NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'qr_pending', 'pairing', 'connected', 'error')),
  phone VARCHAR(20),
  error_message TEXT,
  last_active TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create indexes for fast lookups (only if not exists)
DO $$ BEGIN
  CREATE INDEX idx_whatsapp_sessions_teacher ON whatsapp_sessions(teacher_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX idx_whatsapp_sessions_status ON whatsapp_sessions(status);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX idx_whatsapp_auth_creds_teacher ON whatsapp_auth_creds(teacher_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX idx_whatsapp_auth_keys_teacher ON whatsapp_auth_keys(teacher_id);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- 5. Enable RLS on whatsapp_sessions
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

-- 6. Service role policy (bypasses RLS)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Service role only" ON whatsapp_sessions;
  CREATE POLICY "Service role only" ON whatsapp_sessions
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- 7. Create trigger for updated_at on whatsapp_sessions
CREATE OR REPLACE FUNCTION update_whatsapp_sessions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_whatsapp_sessions_updated_at ON whatsapp_sessions;
CREATE TRIGGER update_whatsapp_sessions_updated_at
  BEFORE UPDATE ON whatsapp_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_sessions_timestamp();
