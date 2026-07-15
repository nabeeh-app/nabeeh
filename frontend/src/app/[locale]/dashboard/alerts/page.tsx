'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { AlertConfig } from '@/components/alerts/AlertConfig';
import { AlertDisplay } from '@/components/alerts/AlertDisplay';

export default function AlertsPage() {
  const t = useTranslations('alerts');

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title') || 'Alerts'}
        description={t('description') || 'Configure and view alert rules and notifications'}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <AlertConfig />
        <AlertDisplay />
      </div>
    </div>
  );
}
