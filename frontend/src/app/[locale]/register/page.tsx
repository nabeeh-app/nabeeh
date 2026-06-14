'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { validateEmail, formatPhoneNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Phone, Mail, User, Building, BookOpen } from 'lucide-react';
import { GridPattern } from '@/components/ui/grid-pattern';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import logger from '@/lib/logger';
import { apiClient } from '@/lib/client';

interface RegisterFormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  business_name: string;
  subjects: string;
  whatsapp_number: string;
}

interface Props {
  params: Promise<{ locale: string }>;
}

export default function RegisterPage({ params: _params }: Props) {
  const locale = useLocale();
  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    business_name: '',
    subjects: '',
    whatsapp_number: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  const router = useRouter();
  const t = useTranslations('auth');
  const isRTL = locale === 'ar';

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('nameRequired');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('emailRequired');
    } else if (!validateEmail(formData.email)) {
      newErrors.email = t('invalidEmail');
    }

    if (!formData.phone.trim()) {
      newErrors.phone = t('phoneRequired');
    } else if (!/^\+\d{10,15}$/.test(formData.phone)) {
      newErrors.phone = t('phoneInvalid');
    }

    if (!formData.password) {
      newErrors.password = t('passwordRequired');
    } else if (formData.password.length < 6) {
      newErrors.password = t('passwordTooShort');
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('confirmPasswordRequired');
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('passwordMismatch');
    }

    if (formData.whatsapp_number && !/^\+\d{10,15}$/.test(formData.whatsapp_number)) {
      newErrors.whatsapp_number = t('whatsappInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof RegisterFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handlePhoneChange = (field: 'phone' | 'whatsapp_number', value: string) => {
    const formatted = formatPhoneNumber(value);
    handleInputChange(field, formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const registrationData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone,
        password: formData.password,
        business_name: formData.business_name.trim() || undefined,
        subjects: formData.subjects ? formData.subjects.split(',').map(s => s.trim()).filter(Boolean) : undefined,
        whatsapp_number: formData.whatsapp_number || formData.phone,
        preferred_language: locale === 'ar' ? 'ar' : 'en'
      };

      await apiClient.register(registrationData);
      setSuccessMessage(t('registerSuccess'));
      
      setTimeout(() => {
        router.push(`/${locale}/login`);
      }, 2000);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      logger.error('Registration error:', error);
      const message = err.response?.data?.message || t('networkError');
      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn(
      "relative min-h-screen flex items-center justify-center bg-canvas py-12 px-4 sm:px-6 lg:px-8",
      isRTL && "font-arabic"
    )} dir={isRTL ? 'rtl' : 'ltr'}>
      <GridPattern
        width={30}
        height={30}
        squares={[[1, 1], [4, 3], [7, 5], [10, 2], [13, 6]]}
        className="opacity-50"
      />
      <div className="relative z-10 max-w-2xl w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-primary font-display">
              {isRTL ? 'نبيه - Nabeeh' : 'Nabeeh - نبيه'}
            </h1>
            <div className="flex gap-2">
              <Link 
                href={`/en/register`}
                className={cn(
                  "px-2 py-1 rounded-none text-sm",
                  locale === 'en' ? "bg-primary/10 text-primary" : "text-ink/60 hover:text-primary"
                )}
              >
                EN
              </Link>
              <Link 
                href={`/ar/register`}
                className={cn(
                  "px-2 py-1 rounded-none text-sm",
                  locale === 'ar' ? "bg-primary/10 text-primary" : "text-ink/60 hover:text-primary"
                )}
              >
                عربي
              </Link>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-ink font-display">
            {t('registerTitle')}
          </h2>
          <p className="mt-2 text-base text-ink/70 font-body">
            {t('registerSubtitle')}
          </p>
        </div>

        {successMessage && (
          <div className="bg-surface-sage border border-ink/20 text-ink px-4 py-3 rounded-none font-body">
            {successMessage}
          </div>
        )}

        {errors.general && (
          <div className="bg-[#c53030]/10 border border-[#c53030]/20 text-[#c53030] px-4 py-3 rounded-none font-body">
            {errors.general}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <User className="h-5 w-5" />
              {t('teacherInfo')}
            </CardTitle>
            <CardDescription className="font-body">
              {t('teacherInfoDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2 font-mono uppercase tracking-wider">
                    <User className="h-4 w-4" />
                    {t('fullName')}
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder={isRTL ? 'أحمد محمد حسن' : 'John Smith'}
                    className={cn(
                      isRTL && 'text-right',
                      errors.name && 'border-[#c53030]'
                    )}
                  />
                  {errors.name && <p className="text-base text-[#c53030]">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2 font-mono uppercase tracking-wider">
                    <Mail className="h-4 w-4" />
                    {t('emailAddress')}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder={isRTL ? 'ahmed@example.com' : 'john@example.com'}
                    className={errors.email ? 'border-[#c53030]' : ''}
                  />
                  {errors.email && <p className="text-base text-[#c53030]">{errors.email}</p>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2 font-mono uppercase tracking-wider">
                    <Phone className="h-4 w-4" />
                    {t('phoneNumber')}
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange('phone', e.target.value)}
                    placeholder="+201234567890"
                    className={errors.phone ? 'border-[#c53030]' : ''}
                  />
                  {errors.phone && <p className="text-base text-[#c53030]">{errors.phone}</p>}
                  <p className="text-xs text-ink/60 font-mono uppercase tracking-wider">
                    {t('phoneHint')}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp_number" className="flex items-center gap-2 font-mono uppercase tracking-wider">
                    <Phone className="h-4 w-4" />
                    {t('whatsappNumber')}
                  </Label>
                  <Input
                    id="whatsapp_number"
                    value={formData.whatsapp_number}
                    onChange={(e) => handlePhoneChange('whatsapp_number', e.target.value)}
                    placeholder={t('whatsappPlaceholder')}
                    className={errors.whatsapp_number ? 'border-[#c53030]' : ''}
                  />
                  {errors.whatsapp_number && <p className="text-base text-[#c53030]">{errors.whatsapp_number}</p>}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password" className="font-mono uppercase tracking-wider">
                    {t('password')} *
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      placeholder={t('passwordPlaceholder')}
                      className={cn(
                        'pr-10',
                        errors.password && 'border-[#c53030]'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/60 hover:text-ink/80"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-base text-[#c53030]">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="font-mono uppercase tracking-wider">
                    {t('confirmPassword')} *
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      placeholder={t('confirmPasswordPlaceholder')}
                      className={cn(
                        'pr-10',
                        errors.confirmPassword && 'border-[#c53030]'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/60 hover:text-ink/80"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-base text-[#c53030]">{errors.confirmPassword}</p>}
                </div>
              </div>

              <div className="border-t border-ink/20 pt-6">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2 font-display">
                  <Building className="h-5 w-5" />
                  {t('additionalInfoOptional')}
                </h3>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="business_name" className="flex items-center gap-2 font-mono uppercase tracking-wider">
                      <Building className="h-4 w-4" />
                      {t('institutionName')}
                    </Label>
                    <Input
                      id="business_name"
                      value={formData.business_name}
                      onChange={(e) => handleInputChange('business_name', e.target.value)}
                      placeholder={isRTL ? 'أكاديمية الرياضيات' : 'Math Academy'}
                      className={isRTL ? 'text-right' : ''}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subjects" className="flex items-center gap-2 font-mono uppercase tracking-wider">
                      <BookOpen className="h-4 w-4" />
                      {t('subjectsYouTeach')}
                    </Label>
                    <Input
                      id="subjects"
                      value={formData.subjects}
                      onChange={(e) => handleInputChange('subjects', e.target.value)}
                      placeholder={isRTL ? 'الرياضيات، الفيزياء، الكيمياء' : 'Mathematics, Physics, Chemistry'}
                      className={isRTL ? 'text-right' : ''}
                    />
                    <p className="text-xs text-ink/60 font-mono uppercase tracking-wider">
                      {t('subjectsHint')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col space-y-4">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin h-4 w-4 border-b-2 border-ink"></div>
                      {t('creatingAccount')}
                    </span>
                  ) : (
                    t('createTeacherAccount')
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-ink/20" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-canvas text-ink/60 font-body">{t('orContinueWith')}</span>
                  </div>
                </div>

                <GoogleSignInButton mode="register" />

                <div className="text-center">
                  <p className="text-base text-ink/70 font-body">
                    {t('alreadyHaveAccount')}{' '}
                    <Link 
                      href={`/${locale}/login`}
                      className="text-primary hover:text-primary/80 font-medium"
                    >
                      {t('signInButton')}
                    </Link>
                  </p>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
