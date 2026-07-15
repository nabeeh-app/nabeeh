'use client';

import DashboardSectionError from '@/components/DashboardSectionError';

export default function MessagesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <DashboardSectionError error={error} reset={reset} sectionKey="messages" />;
}
