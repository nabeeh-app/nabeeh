-- Session invalidation on password reset/change.
-- Tokens issued before password_changed_at are rejected in
-- middleware/auth.js (compares JWT iat). Defaults to NOW() so existing
-- sessions issued before this migration stay valid; only a later reset
-- or change invalidates them.
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ DEFAULT NOW();
