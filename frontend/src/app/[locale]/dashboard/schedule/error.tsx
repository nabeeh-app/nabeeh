'use client';

import DashboardSectionError from '@/components/DashboardSectionError';

export default function ScheduleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardSectionError error={error} reset={reset} sectionKey="schedule" />;
}
