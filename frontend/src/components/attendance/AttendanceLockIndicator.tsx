'use client';

import { useLocale } from 'next-intl';
import { Lock } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

interface LockInfo {
  lockedBy: string;
  lockedAt: string;
}

interface AttendanceLockIndicatorProps {
  lock?: LockInfo | null;
  children: React.ReactNode;
}

export function AttendanceLockIndicator({ lock, children }: AttendanceLockIndicatorProps) {
  const locale = useLocale();

  if (!lock) {
    return <>{children}</>;
  }

  return (
    <div
      className="relative opacity-60 pointer-events-none select-none"
      title={`Locked by ${lock.lockedBy} since ${timeAgo(lock.lockedAt, locale)}`}
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
