'use client';

import DashboardSectionError from '@/components/DashboardSectionError';

export default function AlertsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardSectionError error={error} reset={reset} sectionKey="alerts" />;
}
