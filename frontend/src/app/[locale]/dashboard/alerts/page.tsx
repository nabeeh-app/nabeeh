'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { AlertConfig } from '@/components/alerts/AlertConfig';
import { AlertDisplay } from '@/components/alerts/AlertDisplay';
import { isFeatureEnabled } from '@/config/featureFlags';

export default function AlertsPage() {
  const t = useTranslations('alerts');

  if (!isFeatureEnabled('alerts')) {
    return (
      <div className="text-center py-16 text-ink/60 font-body">
        <p>{t('featureDisabled') || 'Alerts feature is not enabled'}</p>
      </div>
    );
  }

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
