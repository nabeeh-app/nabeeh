import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

  // Create the redirect response first so setAll can write cookies on it.
  // exchangeCodeForSession fires onAuthStateChange which calls setAll
  // asynchronously via applyServerStorage. Writing to the response object
  // (not cookieStore) ensures cookies are included even after the handler returns.
  const response = NextResponse.redirect(`${origin}/${locale}/auth/callback-client`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) {
    return response;
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=oauth_exchange_failed`);
}
