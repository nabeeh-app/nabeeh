'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/language-switcher';
import { validateEmail, cn } from '@/lib/utils';
import { GridPattern } from '@/components/ui/grid-pattern';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const { login, error, isAuthenticated } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
  const isRTL = locale === 'ar';

  useEffect(() => {
    if (isAuthenticated) {
      router.push(`/${locale}/dashboard`);
    }
  }, [isAuthenticated, router, locale]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = t('emailRequired');
    } else if (!validateEmail(email)) {
      newErrors.email = t('invalidEmail');
    }

    if (!password) {
      newErrors.password = t('passwordRequired');
    } else if (password.length < 3) {
      newErrors.password = t('passwordTooShort');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      await login({ email, password });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setErrors({
        general: errorMessage || t('invalidCredentials')
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("min-h-screen flex", isRTL && "font-arabic")} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Left Side — Login Form */}
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
                  <linearGradient id="loginBodyGrad" x1="100" y1="40" x2="100" y2="200" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#05c4b8"/>
                    <stop offset="1" stopColor="#026370"/>
                  </linearGradient>
                </defs>
                <path d="M93 44Q85 15 68 12Q82 20 90 40" fill="#05c4b8"/>
                <path d="M100 40Q108 8 128 8Q112 16 105 38" fill="#05c4b8"/>
                <ellipse cx="100" cy="112" rx="74" ry="82" fill="url(#loginBodyGrad)"/>
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

          {/* Welcome Text */}
          <div className="mb-10">
            <h1 className="text-4xl font-bold text-ink font-display">
              {t('loginTitle')}
            </h1>
            <p className="mt-3 text-lg text-ink/60 font-body">
              {t('loginSubtitle')}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.general && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                <p className="text-sm text-destructive font-body">{errors.general}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-ink font-body" dir="ltr">
                {t('email')}
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@example.com"
                className={cn(
                  "h-12 bg-canvas font-body text-left max-w-full",
                  errors.email && "border-destructive"
                )}
                dir="ltr"
              />
              {errors.email && (
                <p className="text-xs text-destructive font-body" dir="ltr">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-ink font-body" dir="ltr">
                {t('password')}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('password')}
                  className={cn(
                    "h-12 bg-canvas font-body text-left max-w-full",
                    isRTL ? "pl-10" : "pr-10",
                    errors.password && "border-destructive"
                  )}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink/60 transition-colors flex items-center justify-center w-5 h-5",
                    isRTL ? "left-3" : "right-3"
                  )}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-destructive font-body" dir="ltr">{errors.password}</p>
              )}
            </div>

            <div className={cn("flex items-center justify-between", isRTL && "flex-row-reverse")}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-ink/20 text-primary focus:ring-primary accent-primary"
                />
                <span className="text-sm text-ink/60 font-body">{t('rememberMe')}</span>
              </label>
              <Link
                href={`/${locale}/forgot-password`}
                className="text-sm text-primary hover:text-primary/80 font-medium font-body"
              >
                {t('forgotPassword')}
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full h-12 font-body font-medium text-base"
              disabled={isLoading}
            >
              {isLoading ? t('signingIn') : t('signInButton')}
            </Button>

            <p className="text-center text-sm text-ink/60 font-body">
              {t('dontHaveAccount')}{' '}
              <Link
                href={`/${locale}/register`}
                className="text-primary hover:text-primary/80 font-medium"
              >
                {t('register')}
              </Link>
            </p>
          </form>
        </div>
      </div>

      {/* Right Side — Hero Image Panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden">
        {/* Hero Image */}
        <img
          src="/login-hero.jpeg"
          alt={isRTL ? 'مساعد تعليمي ذكي' : 'Smart teaching assistant'}
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Gradient Overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/40 to-ink/10" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-end p-12 text-white">
          <div>
            <h2 className="text-4xl font-bold font-display leading-tight mb-4">
              {isRTL ? 'حوّل فصولك إلى\nتجربة ذكية' : 'Transform your classroom\ninto a smart experience'}
            </h2>
            <p className="text-lg text-white/80 font-body max-w-md">
              {isRTL
                ? 'إدارة الطلاب والحضور والتواصل مع أولياء الأمور — كل ما تحتاجه في مكان واحد'
                : 'Manage students, attendance, and parent communication — everything you need in one place'
              }
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
