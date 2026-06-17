'use client';

import { useTranslations, useLocale } from 'next-intl';
import { MessageCircle, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Footer() {
  const t = useTranslations('landing.footer');
  const tNav = useTranslations('landing.nav');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const phone = process.env.NEXT_PUBLIC_WHATSAPP_MARKETING_PHONE || '201234567890';
  const email = 'hello@nabeeh.com';

  return (
    <footer className="bg-ink text-canvas">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 200 240" fill="none" className="w-8 h-10">
                <defs>
                  <linearGradient id="footerGrad" x1="100" y1="40" x2="100" y2="200" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#05c4b8" />
                    <stop offset="1" stopColor="#026370" />
                  </linearGradient>
                </defs>
                <ellipse cx="100" cy="112" rx="74" ry="82" fill="url(#footerGrad)" />
                <circle cx="70" cy="110" r="32" stroke="white" strokeWidth="6" fill="none" />
                <circle cx="130" cy="110" r="32" stroke="white" strokeWidth="6" fill="none" />
                <ellipse cx="70" cy="112" rx="11" ry="12" fill="white" />
                <ellipse cx="130" cy="112" rx="11" ry="12" fill="white" />
                <path d="M86 142Q100 154 114 142" stroke="white" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              </svg>
              <span className="text-lg font-bold font-display">{isRTL ? 'نظام نبيه' : 'Nabeeh'}</span>
            </div>
            <p className="text-sm text-canvas/50 font-body">{t('tagline')}</p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-semibold font-display text-sm uppercase tracking-wider text-canvas/70">
              {t('quickLinks')}
            </h4>
            <ul className="space-y-2">
              {(['features', 'pricing', 'faq'] as const).map((key) => (
                <li key={key}>
                  <a
                    href={`#${key}`}
                    className="text-sm text-canvas/50 hover:text-canvas transition-colors font-body"
                  >
                    {tNav(key)}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="font-semibold font-display text-sm uppercase tracking-wider text-canvas/70">
              {t('legal')}
            </h4>
            <ul className="space-y-2">
              <li>
                <a
                  href={`/${locale}/terms`}
                  className="text-sm text-canvas/50 hover:text-canvas transition-colors font-body"
                >
                  {t('terms')}
                </a>
              </li>
              <li>
                <a
                  href={`/${locale}/privacy`}
                  className="text-sm text-canvas/50 hover:text-canvas transition-colors font-body"
                >
                  {t('privacy')}
                </a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className={cn('space-y-4', isRTL && 'text-right')}>
            <h4 className="font-semibold font-display text-sm uppercase tracking-wider text-canvas/70">
              {t('contact')}
            </h4>
            <ul className="space-y-3">
              <li>
                <a
                  href={`https://wa.me/${phone}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn('inline-flex items-center gap-2 text-sm text-canvas/50 hover:text-canvas transition-colors font-body', isRTL && 'flex-row-reverse')}
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  {t('whatsapp')}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${email}`}
                  className={cn('inline-flex items-center gap-2 text-sm text-canvas/50 hover:text-canvas transition-colors font-body', isRTL && 'flex-row-reverse')}
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  {t('email')}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 pb-4 border-t border-canvas/10 text-center">
          <p className="text-sm text-canvas/30 font-body">{t('copyright')}</p>
        </div>
      </div>
    </footer>
  );
}
