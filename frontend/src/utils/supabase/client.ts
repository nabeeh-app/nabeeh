import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let clientSingleton: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (clientSingleton) {
    return clientSingleton;
  }

  clientSingleton = createBrowserClient(supabaseUrl!, supabaseAnonKey!, {
    cookieOptions: {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    },
  });

  return clientSingleton;
}

