'use client';

import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { LocaleProvider } from '@/components/locale-provider';
import { AuthProvider } from '@/hooks/useAuth';
import { CookieNotice } from '@/components/CookieNotice';

export default function Providers({
  children,
  locale,
  messages,
}: {
  children: ReactNode;
  locale: string;
  messages: Record<string, unknown>;
}) {
  const queryClient = getQueryClient();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>
          <AuthProvider>
            {children}
            <CookieNotice />
          </AuthProvider>
        </LocaleProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
