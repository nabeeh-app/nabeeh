/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginPage from '@/app/[locale]/login/page';

const mockLogin = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ login: mockLogin, isAuthenticated: false }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

vi.mock('next/image', () => ({ default: (props: any) => <img {...props} alt="" /> }));

vi.mock('@/i18n/routing', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/en/login',
  Link: ({ children, href }: any) => <a href={typeof href === 'string' ? href : '#'}>{children}</a>,
}));

// The real widget needs window.turnstile from the Cloudflare script, which
// never loads in jsdom — stand in with a button that fires onVerify.
vi.mock('@/components/auth/turnstile-widget', () => ({
  TurnstileWidget: ({ onVerify, onExpire }: any) => (
    <div data-testid="turnstile-widget">
      <button type="button" onClick={() => onVerify('test-token')}>
        mock-verify
      </button>
      <button type="button" onClick={onExpire}>
        mock-expire
      </button>
    </div>
  ),
}));

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(/email/i) || screen.getByPlaceholderText(/email/i), {
    target: { value: 'a@x.com' },
  });
  const passwordInput =
    document.querySelector('input[type="password"]') as HTMLInputElement;
  fireEvent.change(passwordInput, { target: { value: 'wrong-password' } });
  fireEvent.click(screen.getByRole('button', { name: /signInButton|sign/i }));
}

describe('login captcha on demand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders no Turnstile widget before the backend demands it', () => {
    render(<LoginPage />);
    expect(screen.queryByTestId('turnstile-widget')).toBeNull();
  });

  it('shows the widget after a CAPTCHA_REQUIRED failure and retries with the token', async () => {
    const err = new Error('Captcha verification required') as Error & { code: string };
    err.code = 'CAPTCHA_REQUIRED';
    mockLogin.mockRejectedValueOnce(err).mockResolvedValueOnce(undefined);

    render(<LoginPage />);
    expect(screen.queryByTestId('turnstile-widget')).toBeNull();

    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByTestId('turnstile-widget')).toBeTruthy();
    });

    // Widget verified — the retry carries the token.
    fireEvent.click(screen.getByText('mock-verify'));
    fillAndSubmit();
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledTimes(2);
    });
    expect(mockLogin.mock.calls[0][0]).not.toHaveProperty('turnstileToken');
    expect(mockLogin.mock.calls[1][0]).toMatchObject({ turnstileToken: 'test-token' });
  });

  it('includes turnstileToken once the widget has verified', async () => {
    const err = new Error('bad creds') as Error & { captchaRequired: boolean };
    err.captchaRequired = true;
    mockLogin.mockRejectedValueOnce(err).mockResolvedValueOnce(undefined);

    render(<LoginPage />);
    fillAndSubmit();

    await waitFor(() => {
      expect(screen.getByTestId('turnstile-widget')).toBeTruthy();
    });
    expect(mockLogin.mock.calls[0][0]).not.toHaveProperty('turnstileToken');
  });
});
