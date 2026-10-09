/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import fs from 'fs';
import path from 'path';
import DashboardPage from '@/app/[locale]/dashboard/page';
import { navigationItems, getVisibleNavigation } from '@/config/navigation';

const mockUseLocale = vi.fn(() => 'en');

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ teacher: { name: 'T', role: 'teacher' }, logout: vi.fn() }),
  usePermissions: () => ({ isTeacher: () => true, isAdmin: () => false }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => mockUseLocale(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/dashboard',
  useParams: () => ({ locale: 'en' }),
}));

// Passthrough stand-in: renders hrefs verbatim so the test asserts the
// page's own prefixing, independent of which Link implementation ships.
vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href }: any) => <a href={typeof href === 'string' ? href : '#'}>{children}</a>,
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/dashboard',
}));

vi.mock('@/lib/client', () => ({
  apiClient: { getDashboardStats: vi.fn().mockResolvedValue({}) },
}));

const wrapper = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const W = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  W.displayName = 'W';
  return W;
};

// Route manifest derived from the filesystem, not a hardcoded list.
function existingDashboardRoutes(): Set<string> {
  const base = path.resolve(process.cwd(), 'src/app/[locale]/dashboard');
  const routes = new Set<string>(['/dashboard']);
  const walk = (dir: string, prefix: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith('[')) {
        if (fs.existsSync(path.join(dir, e.name, 'page.tsx'))) {
          routes.add(`${prefix}/${e.name}`);
        }
        walk(path.join(dir, e.name), `${prefix}/${e.name}`);
      }
    }
  };
  walk(base, '/dashboard');
  return routes;
}

describe('dashboard links', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not route card hrefs through the auto-prefixing localized Link', () => {
    // Regression guard: next-intl Link prefixes the locale itself, so the
    // page must use plain next/link with its own `/${locale}` prefix.
    // Importing Link from @/i18n/routing here reintroduces /en/en/* 404s.
    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/app/[locale]/dashboard/page.tsx'),
      'utf8'
    );
    expect(src).not.toContain("from '@/i18n/routing'");
  });

  it.each(['en', 'ar'])('has no doubled locale prefix in %s', async (locale) => {
    mockUseLocale.mockReturnValue(locale);
    const { container } = render(<DashboardPage />, { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 50));
    const hrefs = [...container.querySelectorAll('a[href]')].map((a) =>
      (a as HTMLAnchorElement).getAttribute('href')
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).not.toMatch(/\/(en|ar)\/(en|ar)\//);
      expect(href).toMatch(new RegExp(`^/${locale}/`));
    }
  });

  it('every config href renders and maps to a real route file', async () => {
    mockUseLocale.mockReturnValue('en');
    const routes = existingDashboardRoutes();
    const { container } = render(<DashboardPage />, { wrapper: wrapper() });
    await new Promise((r) => setTimeout(r, 50));
    const rendered = new Set(
      [...container.querySelectorAll('a[href]')].map((a) =>
        (a as HTMLAnchorElement).getAttribute('href')
      )
    );
    const visible = new Set(
      getVisibleNavigation('teacher')
        .filter((i) => i.descriptionKey)
        .map((i) => `/en${i.href}`)
    );
    for (const item of navigationItems) {
      if (item.disabled || item.roles?.includes('admin')) continue;
      // Cards render only for visible items with a description (feature
      // flags may hide the rest); every item must still map to a real file.
      if (visible.has(`/en${item.href}`)) {
        expect(rendered).toContain(`/en${item.href}`);
      }
      expect(routes.has(item.href)).toBe(true);
    }
  });
});
