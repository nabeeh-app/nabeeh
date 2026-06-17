import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const locale = requestUrl.pathname.split('/')[1] || 'ar';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${requestUrl.origin}/${locale}/auth/callback-client`);
    }
  }

  return NextResponse.redirect(`${requestUrl.origin}/${locale}/login?error=oauth_exchange_failed`);
}
