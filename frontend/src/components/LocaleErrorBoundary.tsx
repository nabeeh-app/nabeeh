'use client';

import { useTranslations } from 'next-intl';
import ErrorBoundary from './error-boundary';

interface Props {
  children: React.ReactNode;
}

export default function LocaleErrorBoundary({ children }: Props) {
  const t = useTranslations('errorBoundary');

  return (
    <ErrorBoundary
      fallbackTexts={{
        title: t('title'),
        description: t('description'),
        errorDetailsLabel: t('errorDetails'),
        tryAgain: t('tryAgain'),
        reloadPage: t('reloadPage'),
        goHome: t('goHome'),
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
