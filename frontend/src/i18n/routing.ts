import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ar'],
  defaultLocale: 'ar',
  localeCookie: {
    name: 'NEXT_LOCALE',
    sameSite: 'lax',
    secure: true,
    httpOnly: true,
    path: '/',
  } as Parameters<typeof defineRouting>[0]['localeCookie'],
});

export type Locale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);
