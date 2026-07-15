# Plan 099: Fix cross-tenant parent lookup in send-to-number

> **Executor instructions**: Follow this plan step by step.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 090 (whatsappQuery supabaseAdmin fix)
- **Category**: security
- **Planned at**: commit `8ce4f6b`, 2026-06-18

## Why this matters

`whatsapp.js:626` looks up a parent by phone using `supabaseAdmin` (bypasses RLS) without filtering by `teacher_id`. This means Teacher A can discover the `id` of any parent in the system (including parents belonging to Teacher B) by sending a message to their phone number. This is an IDOR (Insecure Direct Object Reference) vulnerability.

## Current state

- `backend/routes/whatsapp.js:626-629`:

```js
const { data: parent } = await supabaseAdmin.from('parents').select('id').eq('phone', `+${cleaned}`).maybeSingle();
if (parent) {
  const { data: conversation } = await supabaseAdmin.from('conversations')
    .select('id').eq('parent_id', parent.id).eq('teacher_id', teacherId).maybeSingle();
```

The parent lookup has no teacher_id filter. The conversation lookup IS correctly filtered.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|-------------------------------------|
| Tests | `cd backend && npm test -- --testPathIgnorePatterns="real-db"` | all pass |

## Scope

**In scope**:
- `backend/routes/whatsapp.js` — fix parent lookup to be teacher-scoped

**Out of scope**:
- Other IDOR vectors (defer to separate audit)

## Steps

### Step 1: Fix the parent lookup query

Replace the unscoped parent lookup with a teacher-scoped query through the enrollment chain:

```js
const { data: parent } = await supabaseAdmin
  .from('parents')
  .select('id, students(id, enrollments(id, group:groups(id, offering:offerings(id, teacher_id))))')
  .eq('phone', `+${cleaned}`)
  .maybeSingle();

if (!parent) {
  // No parent found — skip auto-pause
} else {
  const belongsToTeacher = (parent.students || []).some(s =>
    (s.enrollments || []).some(e => e?.group?.offering?.teacher_id === teacherId)
  );
  if (!belongsToTeacher) {
    logger.warn('Cross-tenant parent lookup blocked', { teacherId });
  } else {
    const { data: conversation } = await supabaseAdmin.from('conversations')
      .select('id').eq('parent_id', parent.id).eq('teacher_id', teacherId).maybeSingle();
    // ... existing pause logic
  }
}
```

**Verify**: `grep "belongsToTeacher" backend/routes/whatsapp.js` → 1 match

### Step 2: Run full test suite

**Verify**: `cd backend && npm test -- --testPathIgnorePatterns="real-db"` → all pass

## Done criteria

- [ ] `cd backend && npm test -- --testPathIgnorePatterns="real-db"` exits 0
- [ ] Parent lookup in send-to-number validates teacher ownership
- [ ] `plans/README.md` status row updated

## STOP conditions

- The parent-student-enrollment join doesn't work as expected (verify the query shape against the real schema)
- Tests fail for the whatsapp route

## Maintenance notes

- The enrollment chain query is the same pattern used by `sessionManager.getTeacherForPhone()`. Consider extracting a shared utility in `whatsappQuery.js` like `getParentForTeacher(phone, teacherId)`.
