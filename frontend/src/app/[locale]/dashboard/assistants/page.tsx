'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { AssistantManager } from '@/components/assistants/AssistantManager';
import { isFeatureEnabled } from '@/config/featureFlags';
import ComingSoon from '@/components/ComingSoon';
import { useLocale } from 'next-intl';

export default function AssistantsPage() {
  const t = useTranslations('assistants');
  const tCommon = useTranslations('comingSoon');
  const locale = useLocale();

  if (!isFeatureEnabled('assistants')) {
    return (
      <ComingSoon
        title={tCommon('title')}
        description={tCommon('description')}
        backHref={`/${locale}/dashboard`}
        backLabel={tCommon('backLabel')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pageTitle')}
        description={t('pageDescription')}
      />
      <AssistantManager />
    </div>
  );
}
