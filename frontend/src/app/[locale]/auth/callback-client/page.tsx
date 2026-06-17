'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { createClient } from '@/utils/supabase/client';
import logger from '@/lib/logger';

function CallbackHandler() {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient();

    const handleCallback = async () => {
      try {
        // Session was already established by the server-side code exchange
        // in the Route Handler. Read it from cookies.
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          logger.error('Failed to get session after OAuth:', sessionError);
          router.replace(`/${locale}/login?error=session_error`);
          return;
        }

        if (!session) {
          router.replace(`/${locale}/login?error=no_session`);
          return;
        }

        // Exchange Supabase session for backend JWT
        await exchangeForBackendToken(session);
      } catch (err) {
        logger.error('OAuth callback error:', err);
        router.replace(`/${locale}/login?error=callback_error`);
      }
    };

    const exchangeForBackendToken = async (session: { access_token: string }) => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(`${backendUrl}/auth/oauth/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            access_token: session.access_token,
            provider: 'google'
          }),
          signal: controller.signal
        });
        clearTimeout(timeout);

        const data = await response.json();

        if (data.success) {
          router.replace(`/${locale}/dashboard`);
        } else {
          logger.error('Backend token exchange failed:', data.message);
          router.replace(`/${locale}/login?error=backend_token_failed`);
        }
      } catch (err) {
        logger.error('Backend token exchange error:', err);
        router.replace(`/${locale}/login?error=backend_exchange_failed`);
      }
    };

    handleCallback();
  }, [router, locale, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-ink/60 font-body">Signing you in...</p>
      </div>
    </div>
  );
}

export default function CallbackClientPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-ink/60 font-body">Loading...</p>
        </div>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
