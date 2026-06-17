-- Fix missing columns and indexes for WhatsApp integration

-- Add missing columns used by the code
ALTER TABLE messages ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_id ON messages(whatsapp_message_id);
CREATE INDEX IF NOT EXISTS idx_conversations_chat_id ON conversations(whatsapp_chat_id);
