import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';
import logger from '@/lib/logger';

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
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const locale = new URL(request.url).pathname.split('/')[1] || 'ar';
  const origin = getOrigin(request);

  if (!code) {
    return NextResponse.redirect(`${origin}/${locale}/login?error=oauth_no_code`);
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(`${origin}/${locale}/dashboard`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Ignore if immutable in specific server context
            }
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data?.session) {
    logger.error('OAuth exchangeCodeForSession failed', { error: error?.message, code: error?.code });
    return NextResponse.redirect(`${origin}/${locale}/login?error=oauth_exchange_failed`);
  }

  // Ensure all auth cookies are flushed before redirect
  // The Supabase JS library defers SIGNED_IN notification via setTimeout(0)
  // which may not run before the response is returned in serverless environments
  await new Promise((r) => setTimeout(r, 0));

  const { session } = data;

  // Exchange Supabase session for backend JWT — all server-side, no intermediate page
  try {
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    const backendRes = await fetch(`${backendUrl}/auth/oauth/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: session.access_token,
        provider: 'google'
      }),
    });

    const data = await backendRes.json();

    if (data.success && data.data?.token) {
      // Set the backend JWT cookie on the same response
      // Use 'lax' in production so the cookie survives cross-origin redirects
      // (OAuth flow goes Google → app, and 'strict' blocks cookies on cross-site navigations)
      response.cookies.set('nabeeh_token', data.data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60,
        path: '/',
      });

      response.cookies.set('nabeeh_token_client', data.data.token, {
        httpOnly: false,
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

    // Backend exchange failed — redirect to login with error
    return NextResponse.redirect(`${origin}/${locale}/login?error=oauth_backend_failed`);
  } catch {
    // Backend unreachable — redirect to login with error
    return NextResponse.redirect(`${origin}/${locale}/login?error=oauth_backend_unreachable`);
  }
}
