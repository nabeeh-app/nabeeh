'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { validateEmail } from '@/lib/utils';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const [email, setEmail] = useState('ahmed.hassan@example.com'); // Pre-fill demo email
  const [password, setPassword] = useState('test123'); // Pre-fill demo password
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const { login, error, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get locale from URL params or default to 'en'
  const locale = searchParams.get('locale') || 'en';
  const isRTL = locale === 'ar';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push(`/${locale}/dashboard`);
    }
  }, [isAuthenticated, router, locale]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = locale === 'ar' ? 'البريد الإلكتروني مطلوب' : 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = locale === 'ar' ? 'البريد الإلكتروني غير صحيح' : 'Invalid email format';
    }

    if (!password) {
      newErrors.password = locale === 'ar' ? 'كلمة المرور مطلوبة' : 'Password is required';
    } else if (password.length < 3) {
      newErrors.password = locale === 'ar' ? 'كلمة المرور قصيرة جداً' : 'Password is too short';
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
      // The login function will handle the redirect
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setErrors({ 
        general: errorMessage || (locale === 'ar' ? 'فشل في تسجيل الدخول' : 'Login failed')
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn(
      "min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8",
      isRTL && "font-arabic"
    )} dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-blue-600">
              {isRTL ? 'نبيه - Nabeeh' : 'Nabeeh - نبيه'}
            </h1>
            {/* Simple language switcher */}
            <div className="flex gap-2">
              <Link 
                href="/login?locale=en" 
                className={cn(
                  "px-2 py-1 rounded text-sm",
                  locale === 'en' ? "bg-blue-100 text-blue-800" : "text-gray-600 hover:text-blue-600"
                )}
              >
                EN
              </Link>
              <Link 
                href="/login?locale=ar" 
                className={cn(
                  "px-2 py-1 rounded text-sm",
                  locale === 'ar' ? "bg-blue-100 text-blue-800" : "text-gray-600 hover:text-blue-600"
                )}
              >
                العربية
              </Link>
            </div>
          </div>
          <p className="text-gray-600">
            {locale === 'ar' ? 'مساعد التدريس الذكي' : 'Smart Teaching Assistant'}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-center">
              {locale === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
            </CardTitle>
            <CardDescription className="text-center">
              {locale === 'ar' 
                ? 'أدخل بياناتك للوصول إلى لوحة التحكم' 
                : 'Enter your credentials to access the dashboard'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">
                  {locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ahmed.hassan@example.com"
                  className={cn(errors.email && "border-red-500", isRTL && "text-right")}
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">
                  {locale === 'ar' ? 'كلمة المرور' : 'Password'}
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={locale === 'ar' ? 'كلمة المرور' : 'Password'}
                  className={cn(errors.password && "border-red-500", isRTL && "text-right")}
                  dir={isRTL ? 'rtl' : 'ltr'}
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                )}
              </div>

              {(errors.general || error) && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-sm text-red-600">{errors.general || error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading 
                  ? (locale === 'ar' ? 'جاري تسجيل الدخول...' : 'Signing in...')
                  : (locale === 'ar' ? 'تسجيل الدخول' : 'Sign In')
                }
              </Button>

              <div className="mt-6 p-4 bg-blue-50 rounded-md">
                <p className="text-xs text-blue-800 font-medium mb-2">
                  {locale === 'ar' ? 'حساب تجريبي:' : 'Demo Account:'}
                </p>
                <p className="text-xs text-blue-700">
                  {locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}: ahmed.hassan@example.com<br />
                  {locale === 'ar' ? 'كلمة المرور' : 'Password'}: test123
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  {locale === 'ar' 
                    ? 'البيانات معبأة مسبقاً للتجربة' 
                    : 'Credentials are pre-filled for demo'
                  }
                </p>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Registration Link */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            {isRTL ? 'لا تملك حساباً؟' : "Don't have an account?"}{' '}
            <Link 
              href={`/${locale}/register`}
              className="text-blue-600 hover:text-blue-500 font-medium"
            >
              {isRTL ? 'إنشاء حساب معلم' : 'Create teacher account'}
            </Link>
          </p>
        </div>

        {/* Alternative access */}
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-2">
            {locale === 'ar' ? 'أو الوصول مباشرة إلى:' : 'Or access directly:'}
          </p>
          <div className="flex justify-center gap-2">
            <Link 
              href="/en/login" 
              className="text-blue-600 hover:text-blue-500 font-medium text-sm"
            >
              English Dashboard
            </Link>
            <span className="text-gray-400">|</span>
            <Link 
              href="/ar/login" 
              className="text-blue-600 hover:text-blue-500 font-medium text-sm"
            >
              لوحة التحكم العربية
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
