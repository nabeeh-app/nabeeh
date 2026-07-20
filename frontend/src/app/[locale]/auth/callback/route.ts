import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { randomBytes } from 'crypto';
import logger from '@/lib/logger';

function getOrigin(request: Request): string {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (forwardedHost) {
    return `${proto}://${forwardedHost}`;
  }
  const host = request.headers.get('host');
  if (host) {
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const locale = new URL(request.url).pathname.split('/')[1] || 'ar';
  const origin = getOrigin(request);

  if (!code) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=oauth_no_code`);
  }

  const response = NextResponse.redirect(`${origin}/${locale}/dashboard`);

  const supabase = await createClient(response);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data?.session) {
    logger.error('OAuth exchangeCodeForSession failed', { error: error?.message, code: error?.code });
    return NextResponse.redirect(`${origin}/${locale}/login?error=oauth_exchange_failed`);
  }

  await new Promise((r) => setTimeout(r, 0));

  const { session } = data;

  try {
    let backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      backendUrl = apiUrl.startsWith('http') ? apiUrl : `${origin}${apiUrl}`;
    }

    const backendRes = await fetch(`${backendUrl}/auth/oauth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: session.access_token,
        provider: 'google'
      }),
    });

    const result = await backendRes.json();

    if (result.success && result.data?.token) {
      response.cookies.set('nabeeh_token', result.data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60,
        path: '/',
      });

      const csrfToken = randomBytes(32).toString('hex');
      response.cookies.set('csrf_token', csrfToken, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60,
        path: '/',
      });

      return response;
    }

    logger.error('Backend OAuth exchange returned non-success', { data: result });
    return NextResponse.redirect(`${origin}/${locale}/login?error=oauth_backend_failed`);
  } catch (err) {
    logger.error('Backend unreachable during OAuth callback', { error: err });
    return NextResponse.redirect(`${origin}/${locale}/login?error=oauth_backend_unreachable`);
  }
}
