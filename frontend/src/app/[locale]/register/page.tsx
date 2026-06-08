'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { validateEmail, formatPhoneNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Phone, Mail, User, Building, BookOpen } from 'lucide-react';

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

export default function RegisterPage({ params }: Props) {
  const [locale, setLocale] = useState('en');
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
  const isRTL = locale === 'ar';

  // Initialize locale from params
  useEffect(() => {
    params.then(({ locale: paramLocale }) => setLocale(paramLocale));
  }, [params]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = isRTL ? 'الاسم مطلوب' : 'Name is required';
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = isRTL ? 'البريد الإلكتروني مطلوب' : 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = isRTL ? 'البريد الإلكتروني غير صحيح' : 'Invalid email format';
    }

    // Phone validation
    if (!formData.phone.trim()) {
      newErrors.phone = isRTL ? 'رقم الهاتف مطلوب' : 'Phone number is required';
    } else if (!/^\+\d{10,15}$/.test(formData.phone)) {
      newErrors.phone = isRTL ? 'رقم الهاتف يجب أن يبدأ بـ + ويحتوي على 10-15 رقم' : 'Phone must start with + and contain 10-15 digits';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = isRTL ? 'كلمة المرور مطلوبة' : 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = isRTL ? 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' : 'Password must be at least 6 characters';
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = isRTL ? 'تأكيد كلمة المرور مطلوب' : 'Password confirmation is required';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = isRTL ? 'كلمات المرور غير متطابقة' : 'Passwords do not match';
    }

    // WhatsApp number validation (if provided)
    if (formData.whatsapp_number && !/^\+\d{10,15}$/.test(formData.whatsapp_number)) {
      newErrors.whatsapp_number = isRTL ? 'رقم الواتساب غير صحيح' : 'Invalid WhatsApp number format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof RegisterFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
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
        whatsapp_number: formData.whatsapp_number || formData.phone
      };

      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(
          isRTL 
            ? 'تم إنشاء الحساب بنجاح! سيتم توجيهك لصفحة تسجيل الدخول...' 
            : 'Account created successfully! Redirecting to login...'
        );
        
        setTimeout(() => {
          router.push(`/${locale}/login`);
        }, 2000);
      } else {
        setErrors({ general: data.message || (isRTL ? 'حدث خطأ أثناء التسجيل' : 'Registration failed') });
      }
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ 
        general: isRTL ? 'خطأ في الاتصال بالخادم' : 'Network error. Please try again.' 
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
      <div className="max-w-2xl w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-blue-600">
              {isRTL ? 'نبيه - Nabeeh' : 'Nabeeh - نبيه'}
            </h1>
            {/* Language switcher */}
            <div className="flex gap-2">
              <Link 
                href={`/en/register`}
                className={cn(
                  "px-2 py-1 rounded text-sm",
                  locale === 'en' ? "bg-blue-100 text-blue-800" : "text-gray-600 hover:text-blue-600"
                )}
              >
                EN
              </Link>
              <Link 
                href={`/ar/register`}
                className={cn(
                  "px-2 py-1 rounded text-sm",
                  locale === 'ar' ? "bg-blue-100 text-blue-800" : "text-gray-600 hover:text-blue-600"
                )}
              >
                عربي
              </Link>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isRTL ? 'إنشاء حساب معلم جديد' : 'Create Teacher Account'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isRTL 
              ? 'قم بملء البيانات التالية لإنشاء حسابك والبدء في استخدام نبيه' 
              : 'Fill in the details below to create your account and start using Nabeeh'
            }
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {successMessage}
          </div>
        )}

        {/* General Error */}
        {errors.general && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {errors.general}
          </div>
        )}

        {/* Registration Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {isRTL ? 'بيانات المعلم' : 'Teacher Information'}
            </CardTitle>
            <CardDescription>
              {isRTL 
                ? 'أدخل بياناتك الشخصية ومعلومات التواصل' 
                : 'Enter your personal and contact information'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {isRTL ? 'الاسم الكامل *' : 'Full Name *'}
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder={isRTL ? 'أحمد محمد حسن' : 'John Smith'}
                    className={cn(
                      isRTL && 'text-right',
                      errors.name && 'border-red-500'
                    )}
                  />
                  {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {isRTL ? 'البريد الإلكتروني *' : 'Email Address *'}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder={isRTL ? 'ahmed@example.com' : 'john@example.com'}
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                </div>
              </div>

              {/* Phone Numbers */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {isRTL ? 'رقم الهاتف *' : 'Phone Number *'}
                  </Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handlePhoneChange('phone', e.target.value)}
                    placeholder="+201234567890"
                    className={errors.phone ? 'border-red-500' : ''}
                  />
                  {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
                  <p className="text-xs text-gray-500">
                    {isRTL ? 'يجب أن يبدأ بـ + ورمز الدولة' : 'Must start with + and country code'}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp_number" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {isRTL ? 'رقم الواتساب' : 'WhatsApp Number'}
                  </Label>
                  <Input
                    id="whatsapp_number"
                    value={formData.whatsapp_number}
                    onChange={(e) => handlePhoneChange('whatsapp_number', e.target.value)}
                    placeholder={isRTL ? 'اتركه فارغاً لاستخدام نفس رقم الهاتف' : 'Leave empty to use same as phone'}
                    className={errors.whatsapp_number ? 'border-red-500' : ''}
                  />
                  {errors.whatsapp_number && <p className="text-sm text-red-500">{errors.whatsapp_number}</p>}
                </div>
              </div>

              {/* Password Fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">
                    {isRTL ? 'كلمة المرور *' : 'Password *'}
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      placeholder={isRTL ? 'كلمة مرور قوية' : 'Strong password'}
                      className={cn(
                        'pr-10',
                        errors.password && 'border-red-500'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">
                    {isRTL ? 'تأكيد كلمة المرور *' : 'Confirm Password *'}
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      placeholder={isRTL ? 'أعد كتابة كلمة المرور' : 'Repeat password'}
                      className={cn(
                        'pr-10',
                        errors.confirmPassword && 'border-red-500'
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword}</p>}
                </div>
              </div>

              {/* Optional Information */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  {isRTL ? 'معلومات إضافية (اختيارية)' : 'Additional Information (Optional)'}
                </h3>
                
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="business_name" className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      {isRTL ? 'اسم المؤسسة التعليمية' : 'Institution Name'}
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
                    <Label htmlFor="subjects" className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      {isRTL ? 'المواد التي تدرسها' : 'Subjects You Teach'}
                    </Label>
                    <Input
                      id="subjects"
                      value={formData.subjects}
                      onChange={(e) => handleInputChange('subjects', e.target.value)}
                      placeholder={isRTL ? 'الرياضيات، الفيزياء، الكيمياء' : 'Mathematics, Physics, Chemistry'}
                      className={isRTL ? 'text-right' : ''}
                    />
                    <p className="text-xs text-gray-500">
                      {isRTL ? 'فصل بين المواد بفاصلة' : 'Separate subjects with commas'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex flex-col space-y-4">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {isRTL ? 'جاري إنشاء الحساب...' : 'Creating Account...'}
                    </span>
                  ) : (
                    isRTL ? 'إنشاء حساب معلم' : 'Create Teacher Account'
                  )}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-gray-600">
                    {isRTL ? 'لديك حساب بالفعل؟' : 'Already have an account?'}{' '}
                    <Link 
                      href={`/${locale}/login`}
                      className="text-blue-600 hover:text-blue-500 font-medium"
                    >
                      {isRTL ? 'تسجيل الدخول' : 'Sign in'}
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