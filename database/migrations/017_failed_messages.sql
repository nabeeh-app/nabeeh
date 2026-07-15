CREATE TABLE IF NOT EXISTS failed_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  phone VARCHAR(30) NOT NULL,
  message_content TEXT NOT NULL,
  whatsapp_message_id TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  retried_at TIMESTAMPTZ,
  retry_count INT DEFAULT 0
);

CREATE INDEX idx_failed_messages_teacher ON failed_messages(teacher_id);
CREATE INDEX idx_failed_messages_created ON failed_messages(created_at);

ALTER TABLE failed_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Service role only" ON failed_messages
    FOR ALL USING (auth.role() = 'service_role');
EXCEPTION WHEN undefined_object THEN NULL;
END $$;
