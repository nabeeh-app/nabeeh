# Plan 017: Add characterization tests for critical hooks

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/__tests__/ frontend/src/hooks/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**: none

## Why this matters

Near-zero test coverage exists. Only `src/__tests__/utils.test.ts` covers utility functions. All critical hooks (`useStudents`, `useAttendance`, `useGrades`) that interact with the API client are untested. A single refactor to `apiClient` could silently break every page. Characterization tests lock down the current behavior so refactors can proceed safely.

## Current state

- `frontend/src/__tests__/utils.test.ts:1-108` — only existing test file. Uses vitest `describe/it/expect` pattern. No React rendering, no mock setup.
- `frontend/src/hooks/useStudents.ts:1-51` — exports `useStudents` (query), `useCreateStudent`, `useUpdateStudent`, `useDeleteStudent` (mutations). All use `apiClient` from `@/lib/client`.
- `frontend/src/hooks/useAttendance.ts:1-45` — exports `useAttendanceRecords`, `useAttendanceSummary` (queries), `useCreateAttendance` (mutation). All use `apiClient` from `@/lib/client`.
- `frontend/package.json:11` — test script: `"test": "vitest run"`
- `frontend/package.json:47-48` — testing-library deps installed: `@testing-library/jest-dom` and `@testing-library/react`

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Run tests | `npm test` (in frontend/) | exit 0, all pass |
| Run lint | `npm run lint` (in frontend/) | exit 0 |

## Scope

**In scope** (the only files you should modify):
- `frontend/src/__tests__/hooks/useStudents.test.ts` (create) — tests for useStudents hook
- `frontend/src/__tests__/hooks/useAttendance.test.ts` (create) — tests for useAttendance hooks

**Out of scope** (do NOT touch, even though they look related):
- `frontend/src/__tests__/utils.test.ts` — existing tests, don't modify
- `frontend/src/hooks/useStudents.ts` — source code, don't modify
- `frontend/src/hooks/useAttendance.ts` — source code, don't modify
- Any other hooks or components

## Git workflow

- Branch: `advisor/017-hook-tests`
- Commit per logical unit; message style: `test(frontend): add characterization tests for useStudents and useAttendance hooks`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create useStudents test file

Create `frontend/src/__tests__/hooks/useStudents.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useStudents, useCreateStudent, useUpdateStudent, useDeleteStudent } from '@/hooks/useStudents';

vi.mock('@/lib/client', () => ({
  apiClient: {
    getStudents: vi.fn(),
    createStudent: vi.fn(),
    updateStudent: vi.fn(),
    deleteStudent: vi.fn(),
  },
}));

import { apiClient } from '@/lib/client';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useStudents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useStudents(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should return data after successful fetch', async () => {
    const mockData = { students: [], total: 0 };
    vi.mocked(apiClient.getStudents).mockResolvedValue(mockData as any);

    const { result } = renderHook(() => useStudents(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(apiClient.getStudents).toHaveBeenCalledWith(undefined);
  });

  it('should pass params to apiClient', async () => {
    const mockData = { students: [], total: 0 };
    vi.mocked(apiClient.getStudents).mockResolvedValue(mockData as any);
    const params = { page: 1, limit: 10 };

    renderHook(() => useStudents(params), { wrapper: createWrapper() });

    expect(apiClient.getStudents).toHaveBeenCalledWith(params);
  });
});

describe('useCreateStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call apiClient.createStudent on mutate', async () => {
    const mockResult = { id: '1', name: 'Test' };
    vi.mocked(apiClient.createStudent).mockResolvedValue(mockResult as any);

    const { result } = renderHook(() => useCreateStudent(), { wrapper: createWrapper() });

    result.current.mutate({ name: 'Test', phone: '+201234567890', student_code: 'T001' } as any);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiClient.createStudent).toHaveBeenCalled();
  });
});

describe('useUpdateStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call apiClient.updateStudent on mutate', async () => {
    const mockResult = { id: '1', name: 'Updated' };
    vi.mocked(apiClient.updateStudent).mockResolvedValue(mockResult as any);

    const { result } = renderHook(() => useUpdateStudent(), { wrapper: createWrapper() });

    result.current.mutate({ id: '1', data: { name: 'Updated' } });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiClient.updateStudent).toHaveBeenCalledWith('1', { name: 'Updated' });
  });
});

describe('useDeleteStudent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call apiClient.deleteStudent on mutate', async () => {
    vi.mocked(apiClient.deleteStudent).mockResolvedValue(undefined as any);

    const { result } = renderHook(() => useDeleteStudent(), { wrapper: createWrapper() });

    result.current.mutate('1');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiClient.deleteStudent).toHaveBeenCalledWith('1');
  });
});
```

**Verify**: `ls frontend/src/__tests__/hooks/useStudents.test.ts` → file exists

### Step 2: Create useAttendance test file

Create `frontend/src/__tests__/hooks/useAttendance.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useAttendanceRecords, useAttendanceSummary, useCreateAttendance } from '@/hooks/useAttendance';

vi.mock('@/lib/client', () => ({
  apiClient: {
    getAttendance: vi.fn(),
    getAttendanceSummary: vi.fn(),
    createAttendance: vi.fn(),
  },
}));

import { apiClient } from '@/lib/client';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useAttendanceRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return loading state initially', () => {
    const { result } = renderHook(() => useAttendanceRecords(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should return data after successful fetch', async () => {
    const mockData = { records: [], total: 0 };
    vi.mocked(apiClient.getAttendance).mockResolvedValue(mockData as any);

    const { result } = renderHook(() => useAttendanceRecords(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
  });

  it('should pass params to apiClient', async () => {
    const mockData = { records: [], total: 0 };
    vi.mocked(apiClient.getAttendance).mockResolvedValue(mockData as any);
    const params = { page: 1, limit: 10 };

    renderHook(() => useAttendanceRecords(params), { wrapper: createWrapper() });

    expect(apiClient.getAttendance).toHaveBeenCalledWith(params);
  });
});

describe('useAttendanceSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return data after successful fetch', async () => {
    const mockData = { attendance_rate: 85, present_count: 17, absent_count: 3 };
    vi.mocked(apiClient.getAttendanceSummary).mockResolvedValue(mockData as any);

    const { result } = renderHook(() => useAttendanceSummary(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
  });
});

describe('useCreateAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call apiClient.createAttendance on mutate', async () => {
    const mockResult = { success: true };
    vi.mocked(apiClient.createAttendance).mockResolvedValue(mockResult as any);

    const { result } = renderHook(() => useCreateAttendance(), { wrapper: createWrapper() });

    result.current.mutate({ session_id: '1', attendance: [] } as any);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(apiClient.createAttendance).toHaveBeenCalled();
  });
});
```

**Verify**: `ls frontend/src/__tests__/hooks/useAttendance.test.ts` → file exists

### Step 3: Run tests

Run `npm test` in `frontend/` to verify all tests pass.

**Verify**: `npm test` → exit 0, all tests pass including new ones

### Step 4: Run lint

Run `npm run lint` in `frontend/` to verify no lint violations.

**Verify**: `npm run lint` → exit 0

## Test plan

New tests to write:
- `useStudents.test.ts`: 6 tests covering loading state, data fetch, params pass-through, and all 3 mutations
- `useAttendance.test.ts`: 5 tests covering loading state, data fetch, params pass-through, summary, and mutation
- Pattern: use `renderHook` from `@testing-library/react` with `QueryClientProvider` wrapper
- Mock pattern: `vi.mock('@/lib/client', () => ({ apiClient: { ... } }))`

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm test` exits 0 in `frontend/`; new tests for useStudents and useAttendance exist and pass
- [ ] `npm run lint` exits 0 in `frontend/`
- [ ] `ls frontend/src/__tests__/hooks/useStudents.test.ts` succeeds
- [ ] `ls frontend/src/__tests__/hooks/useAttendance.test.ts` succeeds
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (the codebase has drifted since this plan was written).
- `npm test` fails twice after a reasonable fix attempt.
- The fix appears to require modifying source files in `src/hooks/`.
- `@testing-library/react` or `vitest` are not installed.

## Maintenance notes

For the human/agent who owns this code after the change lands:

- When adding new hooks, add corresponding test files in `src/__tests__/hooks/`.
- If the `apiClient` interface changes, update the mock in both test files.
- These are characterization tests — they lock down current behavior. If behavior intentionally changes, update the tests accordingly.
