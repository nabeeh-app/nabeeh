# Plan 091: Add message idempotency check for incoming WhatsApp messages

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8ce4f6b..HEAD -- backend/lib/whatsappQuery.js backend/routes/whatsapp.js`
> If any in-scope file changed, compare excerpts before proceeding.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 090 (whatsappQuery must use supabaseAdmin first)
- **Category**: bug
- **Planned at**: commit `8ce4f6b`, 2026-06-18

## Why this matters

Baileys can emit the same `messages.upsert` event twice on reconnection. With no dedup, the same message is processed twice, sending duplicate bot responses to parents. The `messages` table already has a `whatsapp_message_id` column with an index (migration 004), but the code never queries it before processing.

## Current state

- `backend/routes/whatsapp.js:66` — `processIncomingMessage(teacherId, phone, messageContent, remoteJid, messageId)` receives `messageId` but never checks if it was already processed
- `backend/lib/whatsappQuery.js:69-87` — `saveMessage()` does unconditional INSERT, no dedup
- `backend/routes/whatsapp.js:117,121` — passes `whatsapp_message_id` to saveMessage but only after processing
- Convention: Zod validation on all input, standard envelope responses

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Tests | `cd backend && npm test -- --testPathIgnorePatterns="real-db"` | all pass |
| Lint | `cd backend && npx eslint routes/whatsapp.js` | exit 0 |

## Scope

**In scope**:
- `backend/lib/whatsappQuery.js` — add `isMessageProcessed(messageId)` function
- `backend/routes/whatsapp.js` — call dedup check in `processIncomingMessage` before processing

**Out of scope**:
- `backend/lib/baileys.js` — no changes to message emission
- Database schema — `whatsapp_message_id` column already exists

## Steps

### Step 1: Add isMessageProcessed function to whatsappQuery.js

Add before `saveMessage`:

```js
async function isMessageProcessed(whatsappMessageId) {
  if (!whatsappMessageId) return false;
  const { data } = await supabaseAdmin
    .from('messages')
    .select('id')
    .eq('whatsapp_message_id', whatsappMessageId)
    .maybeSingle();
  return !!data;
}
```

Export it in `module.exports`.

**Verify**: `cd backend && node -e "const q = require('./lib/whatsappQuery'); console.log(typeof q.isMessageProcessed)"` → `function`

### Step 2: Add dedup check to processIncomingMessage

In `backend/routes/whatsapp.js`, at the top of `processIncomingMessage` (after the `!from || !body` guard), add:

```js
if (messageId) {
  const alreadyProcessed = await whatsappQuery.isMessageProcessed(messageId);
  if (alreadyProcessed) {
    logger.info('Skipping duplicate message', { messageId, teacherId });
    return;
  }
}
```

**Verify**: `cd backend && grep -n "isMessageProcessed" routes/whatsapp.js` → 1 match

### Step 3: Run full test suite

**Verify**: `cd backend && npm test -- --testPathIgnorePatterns="real-db"` → all pass

## Done criteria

- [ ] `cd backend && npm test -- --testPathIgnorePatterns="real-db"` exits 0
- [ ] `grep -rn "isMessageProcessed" backend/lib/whatsappQuery.js` returns 2+ matches (def + export)
- [ ] `grep -rn "isMessageProcessed" backend/routes/whatsapp.js` returns 1 match
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- The `messages` table doesn't have `whatsapp_message_id` column (check with `cd backend && node -e "require('dotenv').config(); const {createClient}=require('@supabase/supabase-js'); const sb=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY); sb.from('messages').select('whatsapp_message_id').limit(1).then(r=>console.log(r.error||'column exists'))"`)
- Plan 090 not yet DONE (whatsappQuery must use supabaseAdmin)

## Maintenance notes

- This is a lightweight dedup — it queries by `whatsapp_message_id` before processing. For high throughput, consider a Redis-based dedup cache. The current approach adds one DB query per incoming message.
- If `whatsapp_message_id` is null (some message types), the check is skipped — this is intentional since null IDs can't be deduplicated.
