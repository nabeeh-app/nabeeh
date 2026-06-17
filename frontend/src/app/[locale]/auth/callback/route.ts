import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const locale = requestUrl.pathname.split('/')[1] || 'ar';

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${requestUrl.origin}/${locale}/auth/callback-client`);
      }
    } catch (err) {
      // Log but don't crash — fall through to error redirect
      console.error('OAuth code exchange failed:', err);
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}/${locale}/login?error=oauth_exchange_failed`);
}
