'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { useLocale } from 'next-intl';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function CallbackHandler() {
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();

  useEffect(() => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const handleCallback = async () => {
      const code = searchParams.get('code');

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          router.replace(`/${locale}/login?error=oauth_exchange_failed`);
          return;
        }
        if (data.session) {
          await exchangeForBackendToken(data.session);
          return;
        }
      }

      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          await exchangeForBackendToken(data.session);
          return;
        }
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await exchangeForBackendToken(sessionData.session);
        return;
      }

      router.replace(`/${locale}/login?error=no_session`);
    };

    const exchangeForBackendToken = async (session: { access_token: string; user: { id: string; email?: string } }) => {
      try {
        const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
        const response = await fetch(`${backendUrl}/auth/oauth/callback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            access_token: session.access_token,
            provider: 'google'
          })
        });

        const data = await response.json();

        if (data.success) {
          // Cookie is set by the backend Set-Cookie header.
          // Redirect to dashboard — AuthProvider will pick up the session.
          router.replace(`/${locale}/dashboard`);
        } else {
          router.replace(`/${locale}/login?error=backend_token_failed`);
        }
      } catch {
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
