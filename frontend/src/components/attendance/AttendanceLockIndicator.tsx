'use client';

import { Lock } from 'lucide-react';

interface LockInfo {
  lockedBy: string;
  lockedAt: string;
}

interface AttendanceLockIndicatorProps {
  lock?: LockInfo | null;
  children: React.ReactNode;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

export function AttendanceLockIndicator({ lock, children }: AttendanceLockIndicatorProps) {
  if (!lock) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative opacity-60 pointer-events-none select-none"
      title={`Locked by ${lock.lockedBy} since ${timeAgo(lock.lockedAt)}`}
    >
      {children}
      <div className="absolute inset-0 flex items-center justify-center bg-canvas/60 rounded-md">
        <div className="flex items-center gap-1.5 text-xs text-ink/70 font-body animate-pulse">
          <Lock className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{lock.lockedBy}</span>
        </div>
      </div>
    </div>
  );
}
