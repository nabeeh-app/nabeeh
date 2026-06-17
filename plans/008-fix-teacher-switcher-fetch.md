# Plan 008: Replace TeacherSwitcher raw fetch with apiClient (SEC-08)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/components/assistants/TeacherSwitcher.tsx frontend/src/lib/api.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**: (none)

## Why this matters

`TeacherSwitcher.tsx` makes raw `fetch()` calls with manual `localStorage.getItem('nabeeh_token')` instead of using the centralized `apiClient`. This bypasses the axios interceptors (401 redirect, retry logic, error normalization) that every other authenticated call uses. Both catch blocks silently swallow all errors, hiding failures from the user. The raw fetch also means the component has its own token management path, which could diverge from the canonical path in `api.ts` if token storage ever changes.

## Current state

- `src/components/assistants/TeacherSwitcher.tsx` — dropdown component (104 lines)
- Lines 28-47 — `fetchLinkedTeachers` with raw fetch:

```tsx
const fetchLinkedTeachers = useCallback(async () => {
  if (teacher?.role !== 'assistant') return;
  setLoading(true);
  try {
    const token = localStorage.getItem('nabeeh_token');
    const res = await fetch('/api/assistants/linked-teachers', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success && data.data) {
      setTeachers(data.data);
      const current = data.data.find((t: LinkedTeacher) => t.id === teacher.teacherId);
      if (current) setCurrentTeacher(current);
    }
  } catch {
    // silently handle
  } finally {
    setLoading(false);
  }
}, [teacher]);
```

- Lines 54-70 — `handleSwitch` with raw fetch:

```tsx
const handleSwitch = async (targetTeacher: LinkedTeacher) => {
  try {
    const token = localStorage.getItem('nabeeh_token');
    await fetch('/api/assistants/switch-teacher', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ teacher_id: targetTeacher.id }),
    });
    setCurrentTeacher(targetTeacher);
    window.location.reload();
  } catch {
    // silently handle
  }
};
```

- `src/lib/api.ts` — the centralized `ApiClient` class (802 lines). Lines 494-545 contain assistant methods (`getAssistants`, `inviteAssistant`, `updateAssistantPermissions`, etc.) but **no** `getLinkedTeachers()` or `switchTeacher()` methods. These two methods must be added.

## Commands you will need

| Purpose   | Command                                          | Expected on success |
|-----------|--------------------------------------------------|---------------------|
| Lint      | `cd frontend && npm run lint`                    | exit 0              |
| Tests     | `cd frontend && npm test`                        | exit 0 (or N/A)     |
| Build     | `cd frontend && npm run build`                   | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `frontend/src/components/assistants/TeacherSwitcher.tsx`
- `frontend/src/lib/api.ts` (only adding two new methods)

**Out of scope** (do NOT touch, even though they look related):
- `src/hooks/useAuth.tsx` — auth provider, no change needed
- Backend assistant routes — not changing API contracts
- Other assistant components — not in scope

## Git workflow

- Branch: `advisor/008-fix-teacher-switcher-fetch`
- Commit per step or per logical unit; message style: conventional commits
  - `feat(api): add getLinkedTeachers and switchTeacher methods`
  - `refactor(assistants): replace raw fetch in TeacherSwitcher with apiClient`

## Steps

### Step 1: Add `getLinkedTeachers()` and `switchTeacher()` to ApiClient

In `src/lib/api.ts`, add the two new methods to the `ApiClient` class. Insert them after the existing assistant methods (after line 545, before the Reports API section starting at line 547).

Add:

```tsx
async getLinkedTeachers(): Promise<ApiResponse<Array<{ id: string; name: string; email: string }>>> {
  const response = await this.api.get('/assistants/linked-teachers');
  return response.data;
}

async switchTeacher(teacherId: string): Promise<void> {
  await this.api.post('/assistants/switch-teacher', { teacher_id: teacherId });
}
```

Note: the `ApiResponse` type is already imported at line 3 of `api.ts`.

**Verify**: `grep -n "getLinkedTeachers" frontend/src/lib/api.ts` returns at least one match

### Step 2: Replace raw fetch in TeacherSwitcher with apiClient

In `src/components/assistants/TeacherSwitcher.tsx`:

1. Add the import at the top (after line 13):

```tsx
import { apiClient } from '@/lib/api';
```

2. Replace the `fetchLinkedTeachers` function body (lines 31-47). Change:

```tsx
const fetchLinkedTeachers = useCallback(async () => {
  if (teacher?.role !== 'assistant') return;
  setLoading(true);
  try {
    const token = localStorage.getItem('nabeeh_token');
    const res = await fetch('/api/assistants/linked-teachers', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success && data.data) {
      setTeachers(data.data);
      const current = data.data.find((t: LinkedTeacher) => t.id === teacher.teacherId);
      if (current) setCurrentTeacher(current);
    }
  } catch {
    // silently handle
  } finally {
    setLoading(false);
  }
}, [teacher]);
```

To:

```tsx
const fetchLinkedTeachers = useCallback(async () => {
  if (teacher?.role !== 'assistant') return;
  setLoading(true);
  try {
    const response = await apiClient.getLinkedTeachers();
    if (response.success && response.data) {
      setTeachers(response.data);
      const current = response.data.find((t: LinkedTeacher) => t.id === teacher.teacherId);
      if (current) setCurrentTeacher(current);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load linked teachers';
    console.error(message);
  } finally {
    setLoading(false);
  }
}, [teacher]);
```

3. Replace the `handleSwitch` function body (lines 54-70). Change:

```tsx
const handleSwitch = async (targetTeacher: LinkedTeacher) => {
  try {
    const token = localStorage.getItem('nabeeh_token');
    await fetch('/api/assistants/switch-teacher', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ teacher_id: targetTeacher.id }),
    });
    setCurrentTeacher(targetTeacher);
    window.location.reload();
  } catch {
    // silently handle
  }
};
```

To:

```tsx
const handleSwitch = async (targetTeacher: LinkedTeacher) => {
  try {
    await apiClient.switchTeacher(targetTeacher.id);
    setCurrentTeacher(targetTeacher);
    window.location.reload();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to switch teacher';
    console.error(message);
  }
};
```

**Verify**: `grep -rn "localStorage.getItem" frontend/src/components/assistants/TeacherSwitcher.tsx` returns no matches

### Step 3: Run lint

```bash
cd frontend && npm run lint
```

**Verify**: exits 0

### Step 4: Run build

```bash
cd frontend && npm run build
```

**Verify**: exits 0

## Test plan

- No automated test infrastructure exists for this component. Verification is manual:
  - `npm run lint` and `npm run build` both pass.
  - No `localStorage.getItem` calls remain in `TeacherSwitcher.tsx`.
  - The component imports from `@/lib/api` and uses `apiClient`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` exits 0 in `frontend/`
- [ ] `npm run build` exits 0 in `frontend/`
- [ ] `grep -rn "localStorage.getItem" frontend/src/components/assistants/TeacherSwitcher.tsx` returns no matches
- [ ] `grep -n "getLinkedTeachers" frontend/src/lib/api.ts` returns at least one match
- [ ] `grep -n "switchTeacher" frontend/src/lib/api.ts` returns at least one match
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at lines 28-47 and 54-70 doesn't match the "Current state" excerpts (codebase has drifted).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
- The backend endpoints `/api/assistants/linked-teachers` or `/api/assistants/switch-teacher` don't exist or have different paths.
- `api.ts` already has `getLinkedTeachers()` or `switchTeacher()` methods (plan assumption is wrong).

## Maintenance notes

- If the assistant API paths change, both the new methods in `api.ts` and any direct fetch callers must be updated. Now there's only one place to update.
- The `console.error` calls in the catch blocks could be replaced with a toast/notification system if one is added to the frontend.
- The component still calls `window.location.reload()` after switching — this is a known UX rough spot that could be improved by having the auth context handle the switch instead.
