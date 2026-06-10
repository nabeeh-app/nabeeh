'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { formatPhoneNumber, validateEmail } from '@/lib/utils';
import { Save, Upload, Phone, Clock, CheckCircle, XCircle, Loader2, MessageSquare } from 'lucide-react';
import apiClient from '@/lib/client';
import logger from '@/lib/logger';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/ui/PageHeader';

interface TeacherSettings {
  name: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  business_name: string;
  bio: string;
  subjects: string[];
  address: string;
  city: string;
  country: string;
  timezone: string;
  telegram_username: string;
}

interface NotificationPref {
  key: string;
  label: string;
  enabled: boolean;
}

const TIMEZONES = [
  { value: 'Africa/Cairo', label: 'Africa/Cairo (GMT+2)' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (GMT+3)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GMT+4)' },
  { value: 'Europe/London', label: 'Europe/London (GMT+0)' },
  { value: 'America/New_York', label: 'America/New_York (GMT-5)' },
] as const;

const t = {
  en: {
    settings: 'Settings',
    description: 'Manage account settings and preferences',
    save: 'Save',
    profile: 'Profile',
    uploadPhoto: 'Upload Photo',
    photoHint: 'JPG or PNG up to 2MB',
    fullName: 'Full Name',
    email: 'Email',
    institution: 'Institution Name',
    subjects: 'Subjects You Teach',
    subjectsPlaceholder: 'Mathematics, Physics',
    bio: 'Bio',
    bioPlaceholder: 'Write a short bio about yourself...',
    contact: 'Contact',
    phone: 'Phone Number',
    whatsapp: 'WhatsApp Number',
    whatsappHint: 'Leave empty to use same as phone number',
    whatsappStatus: 'WhatsApp Status',
    connected: 'Connected',
    disconnected: 'Disconnected',
    partiallyConnected: 'WhatsApp partially connected. Complete setup for full stability.',
    whatsappDisconnected: 'WhatsApp not connected. Open the dashboard to scan QR code.',
    invalidNumber: 'Phone number is not registered on WhatsApp.',
    checkFailed: 'Failed to check WhatsApp status',
    telegram: 'Telegram Username',
    location: 'Location',
    city: 'City',
    country: 'Country',
    timezone: 'Timezone',
    address: 'Address',
    addressPlaceholder: 'Full address',
    notifications: 'Notifications',
    preferences: 'Preferences',
    language: 'Interface Language',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    savedSuccess: 'Settings saved successfully',
    saveError: 'Network error. Please try again.',
    nameRequired: 'Name is required',
    emailRequired: 'Email is required',
    emailInvalid: 'Invalid email format',
    phoneRequired: 'Phone number is required',
    phoneInvalid: 'Invalid phone number format',
    whatsappInvalid: 'Invalid WhatsApp number format',
  },
  ar: {
    settings: 'الإعدادات',
    description: 'إدارة إعدادات الحساب والتفضيلات',
    save: 'حفظ',
    profile: 'الملف الشخصي',
    uploadPhoto: 'تحديث الصورة',
    photoHint: 'JPG أو PNG حتى 2MB',
    fullName: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    institution: 'اسم المؤسسة التعليمية',
    subjects: 'المواد التي تدرسها',
    subjectsPlaceholder: 'الرياضيات، الفيزياء',
    bio: 'نبذة تعريفية',
    bioPlaceholder: 'اكتب نبذة مختصرة عنك...',
    contact: 'التواصل',
    phone: 'رقم الهاتف',
    whatsapp: 'رقم الواتساب',
    whatsappHint: 'اتركه فارغاً لاستخدام نفس رقم الهاتف',
    whatsappStatus: 'حالة الواتساب',
    connected: 'متصل',
    disconnected: 'غير متصل',
    partiallyConnected: 'الواتساب متصل جزئياً. يُفضل إكمال الإعداد.',
    whatsappDisconnected: 'الواتساب غير متصل. افتح لوحة التحكم لمسح رمز QR.',
    invalidNumber: 'رقم الهاتف غير مسجل في الواتساب.',
    checkFailed: 'فشل في التحقق من حالة الواتساب',
    telegram: 'تليجرام',
    location: 'الموقع',
    city: 'المدينة',
    country: 'الدولة',
    timezone: 'المنطقة الزمنية',
    address: 'العنوان',
    addressPlaceholder: 'العنوان الكامل',
    notifications: 'الإشعارات',
    preferences: 'التفضيلات',
    language: 'لغة الواجهة',
    theme: 'المظهر',
    light: 'فاتح',
    dark: 'داكن',
    system: 'حسب النظام',
    savedSuccess: 'تم حفظ الإعدادات بنجاح',
    saveError: 'خطأ في الاتصال بالخادم',
    nameRequired: 'الاسم مطلوب',
    emailRequired: 'البريد الإلكتروني مطلوب',
    emailInvalid: 'البريد الإلكتروني غير صحيح',
    phoneRequired: 'رقم الهاتف مطلوب',
    phoneInvalid: 'رقم الهاتف غير صحيح',
    whatsappInvalid: 'رقم الواتساب غير صحيح',
  },
} as const;

export default function SettingsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const { teacher, updateProfile } = useAuth();
  const isRTL = locale === 'ar';
  const lang = isRTL ? t.ar : t.en;

  const [settings, setSettings] = useState<TeacherSettings>({
    name: '',
    email: '',
    phone: '',
    whatsapp_number: '',
    business_name: '',
    bio: '',
    subjects: [],
    address: '',
    city: '',
    country: 'Egypt',
    timezone: 'Africa/Cairo',
    telegram_username: ''
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [notifications, setNotifications] = useState<NotificationPref[]>([
    { key: 'attendance', label: isRTL ? 'إشعارات الحضور' : 'Attendance notifications', enabled: true },
    { key: 'grades', label: isRTL ? 'إشعارات الدرجات' : 'Grade notifications', enabled: true },
    { key: 'parent_messages', label: isRTL ? 'رسائل أولياء الأمور' : 'Parent messages', enabled: true },
    { key: 'assignments', label: isRTL ? 'تذكيرات الواجبات' : 'Assignment reminders', enabled: false },
    { key: 'system', label: isRTL ? 'إشعارات النظام' : 'System notifications', enabled: true },
  ]);

  useEffect(() => {
    if (teacher) {
      setSettings({
        name: teacher.name || '',
        email: teacher.email || '',
        phone: teacher.phone || '',
        whatsapp_number: teacher.whatsapp_number || teacher.phone || '',
        business_name: teacher.business_name || '',
        bio: teacher.bio || '',
        subjects: teacher.subjects || [],
        address: teacher.address || '',
        city: teacher.city || '',
        country: teacher.country || 'Egypt',
        timezone: teacher.timezone || 'Africa/Cairo',
        telegram_username: teacher.telegram_username || ''
      });
    }
  }, [teacher]);

  useEffect(() => {
    checkWhatsAppStatus();
  }, [settings.whatsapp_number]);

  const checkWhatsAppStatus = async () => {
    if (!settings.whatsapp_number) {
      setWhatsappStatus('disconnected');
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage('');
      const response = await apiClient.api.post('/whatsapp/status', {
        phone: settings.whatsapp_number
      });

      if (response.data.success) {
        setWhatsappStatus(response.data.data?.status || 'disconnected');

        if (response.data.data?.status === 'connected') {
          setStatusMessage(
            response.data.message?.includes('partially connected')
              ? lang.partiallyConnected
              : ''
          );
        } else if (response.data.data?.status === 'disconnected') {
          setStatusMessage(lang.whatsappDisconnected);
        } else if (response.data.data?.status === 'invalid_number') {
          setStatusMessage(lang.invalidNumber);
        } else {
          setStatusMessage(response.data.message || '');
        }
      } else {
        setWhatsappStatus('disconnected');
        setStatusMessage(response.data.message || lang.checkFailed);
      }
    } catch (error: any) {
      logger.error('WhatsApp status check failed:', error);
      if (error.response?.status !== 401) {
        setWhatsappStatus('disconnected');
        setStatusMessage(lang.checkFailed);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!settings.name.trim()) {
      newErrors.name = lang.nameRequired;
    }

    if (!settings.email.trim()) {
      newErrors.email = lang.emailRequired;
    } else if (!validateEmail(settings.email)) {
      newErrors.email = lang.emailInvalid;
    }

    if (!settings.phone.trim()) {
      newErrors.phone = lang.phoneRequired;
    } else if (!/^\+\d{10,15}$/.test(settings.phone)) {
      newErrors.phone = lang.phoneInvalid;
    }

    if (settings.whatsapp_number && !/^\+\d{10,15}$/.test(settings.whatsapp_number)) {
      newErrors.whatsapp_number = lang.whatsappInvalid;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof TeacherSettings, value: string | string[]) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handlePhoneChange = (field: 'phone' | 'whatsapp_number', value: string) => {
    const formatted = formatPhoneNumber(value);
    handleInputChange(field, formatted);
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    setMessage(null);

    try {
      const updateData = {
        name: settings.name.trim(),
        phone: settings.phone,
        whatsapp_number: settings.whatsapp_number || settings.phone,
        business_name: settings.business_name.trim(),
        bio: settings.bio.trim(),
        subjects: settings.subjects.filter(Boolean),
        address: settings.address.trim(),
        city: settings.city.trim(),
        country: settings.country,
        timezone: settings.timezone,
        telegram_username: settings.telegram_username.trim()
      };

      await updateProfile(updateData);

      setMessage({ type: 'success', text: lang.savedSuccess });
      checkWhatsAppStatus();
    } catch (error: any) {
      logger.error('Save settings error:', error);
      setMessage({
        type: 'error',
        text: error?.response?.data?.message || lang.saveError
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleNotification = (key: string) => {
    setNotifications(prev =>
      prev.map(n => n.key === key ? { ...n, enabled: !n.enabled } : n)
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 px-6 py-4 -mt-6">
        <PageHeader title={lang.settings} description={lang.description}>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {lang.save}
          </Button>
        </PageHeader>
      </div>

      {message && (
        <div
          className={`flex items-center gap-2 px-4 py-3 text-sm font-body ${
            message.type === 'success'
              ? 'bg-surface-sage text-ink border border-ink/10'
              : 'bg-destructive/10 text-destructive border border-destructive/20'
          }`}
        >
          {message.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          {message.text}
        </div>
      )}

      {/* Profile */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink font-display">{lang.profile}</h2>

        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src="/avatars/teacher.jpg" />
            <AvatarFallback className="text-base">
              {settings.name.split(' ').map(n => n[0]).join('').toUpperCase() || 'T'}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <Button variant="outline" size="sm" className="gap-2">
              <Upload className="h-4 w-4" />
              {lang.uploadPhoto}
            </Button>
            <p className="text-xs text-ink/60 font-mono uppercase tracking-wider">
              {lang.photoHint}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">{lang.fullName} *</Label>
            <Input
              id="fullName"
              value={settings.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{lang.email} *</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              className={errors.email ? 'border-destructive' : ''}
              value={settings.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="businessName">{lang.institution}</Label>
            <Input
              id="businessName"
              value={settings.business_name}
              onChange={(e) => handleInputChange('business_name', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subjects">{lang.subjects}</Label>
            <Input
              id="subjects"
              value={settings.subjects.join(', ')}
              onChange={(e) => handleInputChange('subjects', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder={lang.subjectsPlaceholder}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio">{lang.bio}</Label>
          <Textarea
            id="bio"
            value={settings.bio}
            onChange={(e) => handleInputChange('bio', e.target.value)}
            placeholder={lang.bioPlaceholder}
            rows={2}
          />
        </div>
      </section>

      <hr className="border-ink/10" />

      {/* Contact */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink font-display">{lang.contact}</h2>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="gap-1.5 inline-flex items-center">
              <Phone className="h-3.5 w-3.5" />
              {lang.phone} *
            </Label>
            <Input
              id="phone"
              dir="ltr"
              value={settings.phone}
              onChange={(e) => handlePhoneChange('phone', e.target.value)}
              placeholder="+201234567890"
              className={errors.phone ? 'border-destructive' : ''}
            />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp" className="gap-1.5 inline-flex items-center">
              <MessageSquare className="h-3.5 w-3.5" />
              {lang.whatsapp}
            </Label>
            <Input
              id="whatsapp"
              dir="ltr"
              value={settings.whatsapp_number}
              onChange={(e) => handlePhoneChange('whatsapp_number', e.target.value)}
              placeholder={settings.phone || "+201234567890"}
              className={errors.whatsapp_number ? 'border-destructive' : ''}
            />
            {errors.whatsapp_number && <p className="text-sm text-destructive">{errors.whatsapp_number}</p>}
            <p className="text-xs text-ink/60 font-mono uppercase tracking-wider">
              {lang.whatsappHint}
            </p>
          </div>
        </div>

        {/* WhatsApp status — compact single row */}
        <div className="flex items-center gap-2 text-sm">
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-ink/40" />
          ) : whatsappStatus === 'connected' ? (
            <CheckCircle className="h-3.5 w-3.5 text-primary" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-destructive" />
          )}
          <span className="font-medium">{lang.whatsappStatus}</span>
          <span className={`text-ink/60 ${whatsappStatus === 'connected' ? 'text-primary' : 'text-destructive'}`}>
            {whatsappStatus === 'connected' ? lang.connected : lang.disconnected}
          </span>
          {statusMessage && (
            <span className="text-ink/50">- {statusMessage}</span>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="telegram">{lang.telegram}</Label>
          <Input
            id="telegram"
            value={settings.telegram_username}
            onChange={(e) => handleInputChange('telegram_username', e.target.value)}
            placeholder="@username"
          />
        </div>
      </section>

      <hr className="border-ink/10" />

      {/* Location */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink font-display">{lang.location}</h2>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="city">{lang.city}</Label>
            <Input
              id="city"
              value={settings.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="country">{lang.country}</Label>
            <Input
              id="country"
              value={settings.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="timezone" className="gap-1.5 inline-flex items-center">
              <Clock className="h-3.5 w-3.5" />
              {lang.timezone}
            </Label>
            <Select
              value={settings.timezone}
              onValueChange={(value) => handleInputChange('timezone', value)}
            >
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">{lang.address}</Label>
            <Input
              id="address"
              value={settings.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder={lang.addressPlaceholder}
            />
          </div>
        </div>
      </section>

      <hr className="border-ink/10" />

      {/* Notifications */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink font-display">{lang.notifications}</h2>

        <div className="divide-y divide-ink/10">
          {notifications.map((item) => (
            <div key={item.key} className="flex items-center justify-between py-3">
              <span className="text-sm text-ink">{item.label}</span>
              <button
                type="button"
                onClick={() => toggleNotification(item.key)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none ${
                  item.enabled ? 'bg-primary' : 'bg-ink/20'
                }`}
                role="switch"
                aria-checked={item.enabled}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out mt-0.5 ${
                    item.enabled ? (isRTL ? '-translate-x-4 mr-0.5' : 'translate-x-4 ml-0.5') : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      <hr className="border-ink/10" />

      {/* Preferences */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink font-display">{lang.preferences}</h2>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="language">{lang.language}</Label>
            <Select defaultValue={locale}>
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="theme">{lang.theme}</Label>
            <Select>
              <SelectTrigger id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{lang.light}</SelectItem>
                <SelectItem value="dark">{lang.dark}</SelectItem>
                <SelectItem value="system">{lang.system}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

    </div>
  );
}
