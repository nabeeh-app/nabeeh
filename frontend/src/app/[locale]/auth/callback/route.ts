import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

function getOrigin(request: Request): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    return `${proto}://${forwardedHost}`;
  }
  const host = request.headers.get('host');
  if (host) {
    return `https://${host}`;
  }
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code');
  const locale = new URL(request.url).pathname.split('/')[1] || 'ar';
  const origin = getOrigin(request);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}/${locale}/auth/callback-client`);
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=oauth_exchange_failed`);
}
