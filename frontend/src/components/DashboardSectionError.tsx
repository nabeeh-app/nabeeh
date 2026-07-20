'use client';

import { useTranslations, useLocale } from 'next-intl';
import { AlertTriangle, RefreshCw, LayoutDashboard, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import logger from '@/lib/logger';

interface SectionErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  sectionKey?: string;
}

export default function DashboardSectionError({
  error,
  reset,
  sectionKey,
}: SectionErrorProps) {
  const t = useTranslations('errors');
  const locale = useLocale();

  logger.error(`DashboardSectionError${sectionKey ? ` (${sectionKey})` : ''}:`, error);

  return (
    <div className="flex items-center justify-center min-h-[40vh] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-none bg-[var(--color-destructive)]/10">
            <AlertTriangle className="h-6 w-6 text-[var(--color-destructive)]" />
          </div>
          <CardTitle className="text-xl font-semibold text-[var(--color-ink)] font-[var(--font-display)]">
            {t('pageCrash')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {process.env.NODE_ENV === 'development' && error && (
            <div className="rounded-md bg-[var(--color-destructive)]/10 p-3">
              <pre className="text-xs text-[var(--color-destructive)] overflow-auto max-h-32 font-[var(--font-mono)]">
                {error.message}
                {error.digest && `\nDigest: ${error.digest}`}
              </pre>
            </div>
          )}
          <Button onClick={reset} className="w-full">
            <RefreshCw className="ms-2 h-4 w-4" />
            {t('tryAgain')}
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="w-full"
          >
            <RotateCcw className="ms-2 h-4 w-4" />
            {t('reloadPage')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              window.location.href = `/${locale}/dashboard`;
            }}
            className="w-full"
          >
            <LayoutDashboard className="ms-2 h-4 w-4" />
            {t('goToDashboard')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
