'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const t = useTranslations('landing.nav');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navLinks = [
    { href: '#features', label: t('features') },
    { href: '#pricing', label: t('pricing') },
    { href: '#faq', label: t('faq') },
  ];

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-canvas/95 backdrop-blur-md border-b border-ink/10 shadow-sm'
          : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href={`/${locale}`} className="flex items-center gap-2">
            <svg viewBox="0 0 200 240" fill="none" className="w-8 h-10">
              <defs>
                <linearGradient id="navBodyGrad" x1="100" y1="40" x2="100" y2="200" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#05c4b8" />
                  <stop offset="1" stopColor="#026370" />
                </linearGradient>
              </defs>
              <path d="M93 44Q85 15 68 12Q82 20 90 40" fill="#05c4b8" />
              <path d="M100 40Q108 8 128 8Q112 16 105 38" fill="#05c4b8" />
              <ellipse cx="100" cy="112" rx="74" ry="82" fill="url(#navBodyGrad)" />
              <ellipse cx="100" cy="108" rx="60" ry="68" fill="#05c4b8" opacity="0.25" />
              <circle cx="70" cy="110" r="32" stroke="white" strokeWidth="6" fill="none" />
              <circle cx="130" cy="110" r="32" stroke="white" strokeWidth="6" fill="none" />
              <path d="M102 102Q100 94 98 102" stroke="white" strokeWidth="5" fill="none" />
              <ellipse cx="70" cy="112" rx="11" ry="12" fill="#083d44" />
              <circle cx="66" cy="108" r="4" fill="white" />
              <ellipse cx="130" cy="112" rx="11" ry="12" fill="#083d44" />
              <circle cx="126" cy="108" r="4" fill="white" />
              <path d="M86 142Q100 154 114 142" stroke="#083d44" strokeWidth="3.5" strokeLinecap="round" fill="none" />
            </svg>
            <span className="text-lg font-bold text-ink font-display">{isRTL ? 'نظام نبيه' : 'Nabeeh'}</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-ink/70 hover:text-ink transition-colors font-body"
              >
                {link.label}
              </a>
            ))}
            <LanguageSwitcher className="!text-ink hover:!bg-surface-cool" />
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/${locale}/login`}>{t('login')}</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={`/${locale}/register`}>{t('startFree')}</Link>
            </Button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-ink"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-canvas border-b border-ink/10 px-4 pb-4">
          <div className="flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-ink/70 hover:text-ink py-2 font-body"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="flex items-center gap-2 pt-2 border-t border-ink/10">
              <LanguageSwitcher className="!text-ink hover:!bg-surface-cool flex-1" />
              <Button variant="ghost" size="sm" className="flex-1" asChild>
                <Link href={`/${locale}/login`} onClick={() => setMobileOpen(false)}>{t('login')}</Link>
              </Button>
              <Button size="sm" className="flex-1" asChild>
                <Link href={`/${locale}/register`} onClick={() => setMobileOpen(false)}>{t('startFree')}</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
