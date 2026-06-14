'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateEmail, cn } from '@/lib/utils';
import { GridPattern } from '@/components/ui/grid-pattern';
import { LanguageSwitcher } from '@/components/language-switcher';
import { Mail, ArrowRight, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const locale = useLocale();
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const isRTL = locale === 'ar';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError(t('emailRequired'));
      return;
    }
    if (!validateEmail(email)) {
      setError(t('invalidEmail'));
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.requestPasswordReset(email);
      setSent(true);
    } catch {
      setError(t('resetRequestFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  if (sent) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center bg-canvas px-6", isRTL && "font-arabic")} dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="w-full max-w-[440px]">
          <div className="bg-white border border-surface-cool p-8 text-center">
            <div className="flex justify-center mb-6">
              <CheckCircle className="w-16 h-16 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-ink font-display mb-4">
              {t('resetEmailSent')}
            </h1>
            <p className="text-ink/60 font-body mb-2">
              {t('resetEmailSentDesc')}
            </p>
            <p className="text-sm text-ink/40 font-body mb-8" dir="ltr">
              {email}
            </p>
            <Link
              href={`/${locale}/login`}
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-medium font-body"
            >
              {t('backToLogin')}
              {!isRTL && <ArrowRight className="w-4 h-4" />}
              {isRTL && <ArrowRight className="w-4 h-4 rotate-180" />}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen flex", isRTL && "font-arabic")} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Left Side — Form */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-20 bg-canvas relative">
        <GridPattern
          width={30}
          height={30}
          squares={[[1, 1], [4, 3], [7, 5], [10, 2], [13, 6]]}
          className="opacity-30"
        />
        <div className="w-full max-w-[440px] mx-auto relative z-10">
          {/* Header */}
          <div className="flex items-center justify-between mb-12">
            <Link href={`/${locale}`} className="flex items-center gap-3">
              <svg viewBox="0 0 200 240" fill="none" className="w-14 h-16">
                <defs>
                  <linearGradient id="fpBodyGrad" x1="100" y1="40" x2="100" y2="200" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#05c4b8"/>
                    <stop offset="1" stopColor="#026370"/>
                  </linearGradient>
                </defs>
                <path d="M93 44Q85 15 68 12Q82 20 90 40" fill="#05c4b8"/>
                <path d="M100 40Q108 8 128 8Q112 16 105 38" fill="#05c4b8"/>
                <ellipse cx="100" cy="112" rx="74" ry="82" fill="url(#fpBodyGrad)"/>
                <ellipse cx="100" cy="108" rx="60" ry="68" fill="#05c4b8" opacity="0.25"/>
                <rect x="78" y="184" width="44" height="10" rx="4" fill="#026370"/>
                <rect x="82" y="196" width="36" height="8" rx="3" fill="#083d44"/>
                <rect x="86" y="206" width="28" height="6" rx="3" fill="#083d44"/>
                <circle cx="70" cy="110" r="32" stroke="white" strokeWidth="6" fill="none"/>
                <circle cx="130" cy="110" r="32" stroke="white" strokeWidth="6" fill="none"/>
                <path d="M102 102Q100 94 98 102" stroke="white" strokeWidth="5" fill="none"/>
                <path d="M38 104Q24 100 16 104" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none"/>
                <path d="M162 104Q176 100 184 104" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none"/>
                <ellipse cx="70" cy="112" rx="11" ry="12" fill="#083d44"/>
                <circle cx="66" cy="108" r="4" fill="white"/>
                <ellipse cx="130" cy="112" rx="11" ry="12" fill="#083d44"/>
                <circle cx="126" cy="108" r="4" fill="white"/>
                <path d="M86 142Q100 154 114 142" stroke="#083d44" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
              </svg>
              <span className="text-2xl font-bold text-ink font-display">{tCommon('appName')}</span>
            </Link>
            <LanguageSwitcher className="!text-ink hover:!bg-surface-cool" />
          </div>

          {/* Title */}
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-ink font-display">
              {t('forgotPasswordTitle')}
            </h1>
            <p className="mt-3 text-lg text-ink/60 font-body">
              {t('forgotPasswordSubtitle')}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 p-3">
                <p className="text-sm text-destructive font-body">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-ink font-body" dir="ltr">
                {t('email')}
              </Label>
              <div className="relative">
                <Mail className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-ink/40", isRTL ? "right-3" : "left-3")} />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teacher@example.com"
                  className={cn(
                    "h-12 bg-canvas font-body max-w-full",
                    isRTL ? "pr-10 text-right" : "pl-10 text-left",
                    error && "border-destructive"
                  )}
                  dir="ltr"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 font-body font-medium text-base"
              disabled={isLoading}
            >
              {isLoading ? t('sending') : t('sendResetLink')}
            </Button>

            <p className="text-center text-sm text-ink/60 font-body">
              <Link
                href={`/${locale}/login`}
                className="text-primary hover:text-primary/80 font-medium"
              >
                {t('backToLogin')}
              </Link>
            </p>
          </form>
        </div>
      </div>

      {/* Right Side — Hero (hidden on mobile) */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        <img
          src="/login-hero.jpeg"
          alt={isRTL ? 'مساعد تعليمي ذكي' : 'Smart teaching assistant'}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-ink/10" />
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <div>
            <h2 className="text-4xl font-bold font-display leading-tight mb-4">
              {isRTL ? 'لا تقلق\nنسيت كلمة المرور' : "Don't worry\nForget your password"}
            </h2>
            <p className="text-lg text-white/80 font-body max-w-md">
              {isRTL
                ? 'سنرسل لك رابط لإعادة تعيين كلمة المرور في ثوانٍ'
                : "We'll send you a link to reset your password in seconds"}
            </p>
          </div>
          <div className="mt-12 pt-8 border-t border-white/10">
            <p className="text-sm text-white/50 font-body">
              {t('copyright')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
