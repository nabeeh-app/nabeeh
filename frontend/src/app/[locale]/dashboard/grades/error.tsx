'use client';

import DashboardSectionError from '@/components/DashboardSectionError';

export default function GradesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardSectionError error={error} reset={reset} sectionKey="grades" />;
}
