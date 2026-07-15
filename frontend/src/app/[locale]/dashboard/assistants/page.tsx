'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/ui/PageHeader';
import { AssistantManager } from '@/components/assistants/AssistantManager';

export default function AssistantsPage() {
  const t = useTranslations('assistants');

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
