# Plan 053: Resolve multi-teacher parent message routing

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat HEAD -- backend/lib/sessionManager.js backend/routes/whatsapp.js`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6e6ee99`, 2026-06-18

## Why this matters

`getTeacherForPhone` takes `parent?.students?.[0]?.enrollments?.[0]?.group?.offering?.teacher_id` — only the first student's teacher. If a parent has students with different teachers, messages are routed to only one teacher. The other teacher never sees the messages.

## Current state

- `backend/lib/sessionManager.js:219-248`:
  ```js
  async getTeacherForPhone(phone) {
    const cleanPhone = phone.replace('+', '').replace(/[^0-9]/g, '');
    const { data: parent, error } = await supabaseAdmin
      .from('parents')
      .select(`id, students (id, enrollments (id, group:groups (id, offering:offerings (id, teacher_id))))`)
      .eq('phone', `+${cleanPhone}`)
      .single();
    if (error || !parent) return null;
    const teacherId = parent?.students?.[0]?.enrollments?.[0]?.group?.offering?.teacher_id;
    return teacherId || null;
  }
  ```

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Tests     | `cd backend && npm test`             | 235 pass            |

## Scope

**In scope**:
- `backend/lib/sessionManager.js` — return all unique teacherIds
- `backend/routes/whatsapp.js` — update caller to handle array

**Out of scope**: No other files

## Steps

### Step 1: Change getTeacherForPhone to return all teacher IDs

In `backend/lib/sessionManager.js`, replace the method (lines 219-248) with:

```js
async getTeacherForPhone(phone) {
  const cleanPhone = phone.replace('+', '').replace(/[^0-9]/g, '');

  const { data: parent, error } = await supabaseAdmin
    .from('parents')
    .select(`
      id,
      students (
        id,
        enrollments (
          id,
          group:groups (
            id,
            offering:offerings (
              id,
              teacher_id
            )
          )
        )
      )
    `)
    .eq('phone', `+${cleanPhone}`)
    .single();

  if (error || !parent) return null;

  // Collect all unique teacher IDs from all students/enrollments
  const teacherIds = new Set();
  for (const student of parent.students || []) {
    for (const enrollment of student.enrollments || []) {
      const teacherId = enrollment?.group?.offering?.teacher_id;
      if (teacherId) teacherIds.add(teacherId);
    }
  }

  return teacherIds.size > 0 ? Array.from(teacherIds) : null;
}
```

### Step 2: Update callers in whatsapp.js

In `backend/routes/whatsapp.js`, find all calls to `sessionManager.getTeacherForPhone` and update them to handle the array return. The main caller is in the WhatsApp webhook handler. Search for `getTeacherForPhone` and update each usage:

For each call site, change from:
```js
const teacherId = await sessionManager.getTeacherForPhone(phone);
if (!teacherId) { ... }
const client = sessionManager.getSession(teacherId);
```

To:
```js
const teacherIds = await sessionManager.getTeacherForPhone(phone);
if (!teacherIds || teacherIds.length === 0) { ... }
// Send to first available teacher (or fan out — see maintenance note)
const client = sessionManager.getSession(teacherIds[0]);
```

**Verify**: `cd backend && npm test` → 235 pass

## Test plan

Update `sessionManager.spec.js` test for `getTeacherForPhone` to verify it returns an array.

## Done criteria

- [ ] `getTeacherForPhone` returns `string[]` or `null`
- [ ] All callers handle the array return type
- [ ] `cd backend && npm test` exits 0

## STOP conditions

- If `getTeacherForPhone` no longer exists

## Maintenance notes

- This returns ALL teacher IDs. The caller currently picks `teacherIds[0]`. A future improvement could fan out messages to all teachers, but that requires UI changes. For now, first-teacher routing is acceptable.
