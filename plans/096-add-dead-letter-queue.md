# Plan 096: Add dead letter queue for failed WhatsApp messages

> **Executor instructions**: Follow this plan step by step.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 090 (whatsappQuery supabaseAdmin fix)
- **Category**: reliability
- **Planned at**: commit `8ce4f6b`, 2026-06-18

## Why this matters

When `processIncomingMessage()` fails, the error is logged and the message is silently dropped. There's no mechanism to retry, alert operators, or replay messages after a bug fix. Enterprise systems require dead letter queues (DLQ) to prevent data loss.

## Current state

- `backend/routes/whatsapp.js:55-57` — `catch (error) { logger.error(...) }` — message silently dropped
- No `failed_messages` table exists
- Convention: Supabase tables with RLS, standard envelope API responses

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|-------------------------------------|
| Tests | `cd backend && npm test -- --testPathIgnorePatterns="real-db"` | all pass |

## Scope

**In scope**:
- `database/migrations/017_failed_messages.sql` — create table (new file)
- `backend/lib/whatsappQuery.js` — add `saveFailedMessage()` function
- `backend/routes/whatsapp.js` — call `saveFailedMessage()` in catch block

**Out of scope**:
- Retry mechanism (defer — this plan only captures failures)
- Admin UI for viewing failed messages (defer)
- Outgoing message DLQ (separate concern)

## Steps

### Step 1: Create migration for failed_messages table

Create `database/migrations/017_failed_messages.sql`:

```sql
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
```

**Verify**: File exists at `database/migrations/017_failed_messages.sql`

### Step 2: Add saveFailedMessage to whatsappQuery.js

```js
async function saveFailedMessage({ teacherId, phone, messageContent, whatsappMessageId, error }) {
  const { error: dbError } = await supabaseAdmin
    .from('failed_messages')
    .insert({
      teacher_id: teacherId,
      phone,
      message_content: messageContent,
      whatsapp_message_id: whatsappMessageId || null,
      error_message: error.message,
      error_stack: error.stack || null
    });
  if (dbError) {
    logger.error('Failed to save failed message', { error: dbError.message });
  }
}
```

Export in `module.exports`.

**Verify**: `cd backend && node -e "const q = require('./lib/whatsappQuery'); console.log(typeof q.saveFailedMessage)"` → `function`

### Step 3: Call saveFailedMessage in processIncomingMessage catch block

In `backend/routes/whatsapp.js`, change the catch block in `processIncomingMessage` from:

```js
} catch (error) {
  logger.error('Error handling incoming message', { teacherId, error: error.message });
}
```

To:

```js
} catch (error) {
  logger.error('Error handling incoming message', { teacherId, error: error.message });
  await whatsappQuery.saveFailedMessage({
    teacherId, phone, messageContent,
    whatsappMessageId: messageId,
    error
  }).catch(err => logger.error('DLQ write failed', { error: err.message }));
}
```

**Verify**: `grep "saveFailedMessage" backend/routes/whatsapp.js` → 1 match

### Step 4: Apply migration to DB and run tests

**Verify**: `cd backend && npm test -- --testPathIgnorePatterns="real-db"` → all pass

## Done criteria

- [ ] Migration file `017_failed_messages.sql` exists
- [ ] `saveFailedMessage` function exists in whatsappQuery.js
- [ ] `processIncomingMessage` catch block calls `saveFailedMessage`
- [ ] `cd backend && npm test -- --testPathIgnorePatterns="real-db"` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- Migration fails to apply (table name conflict)
- `saveFailedMessage` not exported from whatsappQuery

## Maintenance notes

- Failed messages accumulate indefinitely. Add a cron job to purge messages older than 30 days.
- The `retry_count` and `retried_at` columns are for a future retry mechanism.
- No admin API yet to view/ack failed messages — add when needed.
