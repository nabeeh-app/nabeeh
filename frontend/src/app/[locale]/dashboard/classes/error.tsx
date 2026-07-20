'use client';

import DashboardSectionError from '@/components/DashboardSectionError';

export default function ClassesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardSectionError error={error} reset={reset} sectionKey="classes" />;
}
