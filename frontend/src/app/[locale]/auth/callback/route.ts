import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const locale = requestUrl.pathname.split('/')[1] || 'en';

  // Supabase handles the OAuth flow and redirects here with tokens in the URL
  // We just need to redirect to the client-side callback page that handles the session
  return NextResponse.redirect(
    new URL(`/${locale}/auth/callback-client`, request.url)
  );
}
