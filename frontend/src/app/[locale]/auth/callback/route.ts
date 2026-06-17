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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component — safe to ignore
          }
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (!error) {
    return NextResponse.redirect(`${origin}/${locale}/auth/callback-client`);
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=oauth_exchange_failed`);
}
