/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Sidebar } from '@/components/sidebar';
import { Dialog, DialogContent } from '@/components/ui/dialog';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ logout: vi.fn(), teacher: { name: 'T', role: 'teacher' } }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/dashboard',
}));

vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/dashboard',
  Link: ({ children, href }: any) => <a href={typeof href === 'string' ? href : '#'}>{children}</a>,
}));

vi.mock('next/image', () => ({ default: (props: any) => <img {...props} alt="" /> }));

describe('phone fixes', () => {
  it('sidebar nav scrolls so SignOut stays reachable in a short drawer', () => {
    render(<Sidebar />);
    const nav = document.querySelector('nav');
    expect(nav?.className).toContain('overflow-y-auto');
    expect(nav?.className).toContain('min-h-0');
  });

  it('dialog keeps a side margin on 360px viewports', () => {
    render(
      <Dialog open>
        <DialogContent>body</DialogContent>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.className).toContain('w-[calc(100%-2rem)]');
  });
});
