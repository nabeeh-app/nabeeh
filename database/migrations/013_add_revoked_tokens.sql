CREATE TABLE IF NOT EXISTS revoked_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jti TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revoked_tokens_jti ON revoked_tokens(jti);
CREATE INDEX idx_revoked_tokens_expires_at ON revoked_tokens(expires_at);

ALTER TABLE revoked_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access (bypasses RLS)
CREATE POLICY "Service role only" ON revoked_tokens
  FOR ALL
  USING (true)
  WITH CHECK (true);
