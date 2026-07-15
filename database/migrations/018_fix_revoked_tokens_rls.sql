-- Fix: restrict revoked_tokens to service role only
-- Original policy used USING (true) which allowed any authenticated user
-- to read, insert, update, and delete revoked tokens.
-- All access goes through supabaseAdmin (service role key) in backend/lib/auth.js.

DROP POLICY IF EXISTS "Service role only" ON revoked_tokens;

CREATE POLICY "Service role only" ON revoked_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
