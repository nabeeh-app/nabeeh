# Plan 005: Fix useWhatsAppStatus polling effect (CORRECTNESS-01)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2e8fb57..HEAD -- frontend/src/hooks/useWhatsAppStatus.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `2e8fb57`, 2026-06-16
- **Issue**: N/A

## Why this matters

The `useWhatsAppStatus` hook has a polling `useEffect` that depends on `whatsappStatus.status` in its dependency array. When the effect runs, it sets `whatsappStatus` (via `checkStatus()` or the interval callback), which changes `whatsappStatus.status`, which triggers the effect to re-run. This creates an infinite loop of: effect runs → sets status → status changes → effect re-runs → clears old interval → creates new interval → sets status → ... The effect also calls `checkStatus()` on every re-run, duplicating the initial fetch. The result is excessive API calls and potential flickering UI.

## Current state

Full file (`src/hooks/useWhatsAppStatus.ts:1-98`):

```ts
import { useState, useEffect, useCallback } from 'react';
import { checkWhatsAppStatus } from '@/lib/utils';

export interface WhatsAppStatus {
  status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'qr_ready';
  message: string;
  sessionExists: boolean;
  isLoading: boolean;
  qr?: string | null;
  phone?: string | null;
}

export const useWhatsAppStatus = (phone?: string, autoCheck = true) => {
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>({
    status: 'disconnected',
    message: 'Checking WhatsApp connection...',
    sessionExists: false,
    isLoading: false,
    qr: null,
    phone: null
  });

  const checkStatus = useCallback(async () => {
    // if (!phone && autoCheck) return; // Removed to allow status check without phone

    setWhatsappStatus(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await checkWhatsAppStatus(phone);
      setWhatsappStatus({
        status: result.status,
        message: result.message,
        sessionExists: result.status === 'connected',
        isLoading: false,
        qr: result.qr,
        phone: result.phone
      });
    } catch {
      setWhatsappStatus({
        status: 'error',
        message: 'Error checking WhatsApp status',
        sessionExists: false,
        isLoading: false,
        qr: null,
        phone: null
      });
    }
  }, [phone]);

  useEffect(() => {
    if (!autoCheck) return;

    void (async () => {
      await checkStatus();
    })();

    // Don't poll if already connected
    if (whatsappStatus.status === 'connected') {
      return;
    }

    // Adaptive polling: faster when QR is ready (3s), slower otherwise (30s)
    const pollInterval = whatsappStatus.status === 'qr_ready' ? 3000 : 30000;

    const interval = setInterval(async () => {
      const result = await checkWhatsAppStatus(phone);
      if (result.status === 'connected') {
        clearInterval(interval);
        setWhatsappStatus({
          status: result.status,
          message: result.message,
          sessionExists: true,
          isLoading: false,
          qr: result.qr,
          phone: result.phone
        });
      } else {
        setWhatsappStatus(prev => ({
          ...prev,
          status: result.status,
          message: result.message,
          sessionExists: result.status === 'connected',
          isLoading: false,
          qr: result.qr,
          phone: result.phone
        }));
      }
    }, pollInterval);
    
    return () => clearInterval(interval);
  }, [checkStatus, whatsappStatus.status, autoCheck, phone]);

  return {
    whatsappStatus,
    checkStatus,
    refreshStatus: checkStatus
  };
};
```

The bug: line 91 has `whatsappStatus.status` in the dependency array. The `checkStatus` callback at line 23 depends only on `[phone]`.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Lint      | `npm run lint`           | exit 0              |

## Scope

**In scope** (the only files you should modify):
- `src/hooks/useWhatsAppStatus.ts`

**Out of scope** (do NOT touch, even though they look related):
- `src/lib/utils.ts` — the `checkWhatsAppStatus` function.
- Any component that uses this hook.

## Git workflow

- Branch: `advisor/005-fix-whatsapp-polling`
- Commit message: `fix: prevent infinite re-run loop in useWhatsAppStatus polling effect`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add useRef import and statusRef

Add `useRef` to the React import on line 1:

```ts
import { useState, useEffect, useCallback, useRef } from 'react';
```

After the `useState` declaration (after line 21), add a ref to track the current status without triggering re-renders:

```ts
const statusRef = useRef(whatsappStatus.status);
```

### Step 2: Keep statusRef in sync with state

Update the `statusRef.current` whenever `whatsappStatus` changes. Add this line right after each `setWhatsappStatus` call inside `checkStatus` (lines 30 and 39):

After the `setWhatsappStatus` at line 30 (inside the try block):
```ts
statusRef.current = result.status;
```

After the `setWhatsappStatus` at line 39 (inside the catch block):
```ts
statusRef.current = 'error';
```

### Step 3: Rewrite the useEffect

Replace the entire `useEffect` (lines 50–91) with:

```ts
useEffect(() => {
  if (!autoCheck) return;

  // Initial check on mount and when phone/autoCheck change
  void checkStatus();

  // Don't set up polling if already connected
  if (statusRef.current === 'connected') {
    return;
  }

  // Adaptive polling: faster when QR is ready (3s), slower otherwise (30s)
  const getInterval = () => statusRef.current === 'qr_ready' ? 3000 : 30000;

  let interval: ReturnType<typeof setInterval>;

  const startInterval = () => {
    interval = setInterval(async () => {
      const result = await checkWhatsAppStatus(phone);
      if (result.status === 'connected') {
        clearInterval(interval);
        statusRef.current = result.status;
        setWhatsappStatus({
          status: result.status,
          message: result.message,
          sessionExists: true,
          isLoading: false,
          qr: result.qr,
          phone: result.phone
        });
      } else {
        statusRef.current = result.status;
        setWhatsappStatus(prev => ({
          ...prev,
          status: result.status,
          message: result.message,
          sessionExists: result.status === 'connected',
          isLoading: false,
          qr: result.qr,
          phone: result.phone
        }));
        // Restart interval if polling speed changed (qr_ready ↔ other)
        clearInterval(interval);
        startInterval();
      }
    }, getInterval());
  };

  startInterval();

  return () => clearInterval(interval);
}, [checkStatus, autoCheck, phone]);
```

Key changes:
- Removed `whatsappStatus.status` from the dependency array — the effect only re-runs when `checkStatus`, `autoCheck`, or `phone` change.
- Uses `statusRef.current` instead of reading `whatsappStatus.status` for the connected/qr_ready checks.
- The interval restarts itself when the polling speed needs to change (qr_ready ↔ other), instead of the effect re-running.

### Step 4: Verify lint and typecheck

**Verify**: `npm run lint` in `frontend/` → exit 0
**Verify**: `npx tsc --noEmit` in `frontend/` → exit 0, no errors

## Test plan

No automated tests for this hook. Manual verification:

- Mount a component using `useWhatsAppStatus`. The hook should call `checkWhatsAppStatus` once on mount.
- If status is not `connected`, polling should start at 30s intervals.
- If status becomes `qr_ready`, polling should switch to 3s intervals without re-running the initial check.
- When status becomes `connected`, polling should stop.
- Changing the `phone` prop should restart polling with the new phone.
- Setting `autoCheck=false` should prevent any polling.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npm run lint` in `frontend/` exits 0
- [ ] `npx tsc --noEmit` in `frontend/` exits 0
- [ ] `grep -rn "whatsappStatus.status" frontend/src/hooks/useWhatsAppStatus.ts` → no matches in dependency arrays (only in return value and comparisons)
- [ ] No files outside `src/hooks/useWhatsAppStatus.ts` are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `src/hooks/useWhatsAppStatus.ts` doesn't match the excerpts (the codebase has drifted since this plan was written).
- A step's verification fails twice after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.
- A type error appears after the change (indicates a mismatch with React's useEffect types).

## Maintenance notes

For the human/agent who owns this code after the change lands:

- The `statusRef` pattern (ref to avoid stale closure + effect re-runs) is a standard React idiom for effects that need to read state without depending on it.
- If `checkWhatsAppStatus` is ever memoized with additional dependencies, the `checkStatus` callback's dependency array must be updated accordingly.
- A reviewer should confirm the interval restart logic handles the qr_ready ↔ other transition correctly without double-polling.
- Consider adding a test with `@testing-library/react-hooks` to verify the polling behavior in the future.
