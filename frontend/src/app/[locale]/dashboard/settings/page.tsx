'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { formatPhoneNumber, validateEmail } from '@/lib/utils';
import { Save, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import apiClient from '@/lib/client';
import logger from '@/lib/logger';
import { PageHeader } from '@/components/ui/PageHeader';
import ProfileForm from '@/components/dashboard/settings/ProfileForm';
import LocationSection from '@/components/dashboard/settings/LocationSection';
import NotificationPrefs from '@/components/dashboard/settings/NotificationPrefs';
import PreferencesSection from '@/components/dashboard/settings/PreferencesSection';

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
    notifAttendance: 'Attendance notifications',
    notifGrades: 'Grade notifications',
    notifParentMessages: 'Parent messages',
    notifAssignments: 'Assignment reminders',
    notifSystem: 'System notifications',
    mockModeTitle: 'Mock Mode Active',
    mockModeDescription: 'WhatsApp is unavailable in mock mode. Set NEXT_PUBLIC_USE_MOCK=false in .env.local and restart the dev server.',
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
    notifAttendance: 'إشعارات الحضور',
    notifGrades: 'إشعارات الدرجات',
    notifParentMessages: 'رسائل أولياء الأمور',
    notifAssignments: 'تذكيرات الواجبات',
    notifSystem: 'إشعارات النظام',
    mockModeTitle: 'وضع العرض التجريبي',
    mockModeDescription: 'الواتساب غير متاح في وضع العرض التجريبي. عيّن NEXT_PUBLIC_USE_MOCK=false في .local.env وأعد تشغيل الخادم.',
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
    { key: 'attendance', label: lang.notifAttendance, enabled: true },
    { key: 'grades', label: lang.notifGrades, enabled: true },
    { key: 'parent_messages', label: lang.notifParentMessages, enabled: true },
    { key: 'assignments', label: lang.notifAssignments, enabled: false },
    { key: 'system', label: lang.notifSystem, enabled: true },
  ]);

  useEffect(() => {
    if (teacher) {
      void (async () => {
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
      })();
    }
  }, [teacher]);

  const debouncedWhatsappNumber = useDebounce(settings.whatsapp_number, 500);

  const checkWhatsAppStatus = useCallback(async () => {
    if (!settings.whatsapp_number) {
      setWhatsappStatus('disconnected');
      return;
    }

    try {
      setIsLoading(true);
      setStatusMessage('');
      const data = await apiClient.getWhatsAppStatus();

      if (data) {
        const status = data.status as 'connected' | 'disconnected';
        setWhatsappStatus(status || 'disconnected');

        if (status === 'connected') {
          setStatusMessage('');
        } else if (status === 'disconnected') {
          setStatusMessage(lang.whatsappDisconnected);
        }
      } else {
        setWhatsappStatus('disconnected');
        setStatusMessage(lang.checkFailed);
      }
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      logger.error('WhatsApp status check failed:', error);
      if (err.response?.status !== 401) {
        setWhatsappStatus('disconnected');
        setStatusMessage(lang.checkFailed);
      }
    } finally {
      setIsLoading(false);
    }
  }, [settings.whatsapp_number, lang.whatsappDisconnected, lang.checkFailed]);

  useEffect(() => {
    void (async () => {
      await checkWhatsAppStatus();
    })();
  }, [checkWhatsAppStatus, debouncedWhatsappNumber]);

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
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      logger.error('Save settings error:', error);
      setMessage({
        type: 'error',
        text: err?.response?.data?.message || lang.saveError
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

      <ProfileForm
        settings={settings}
        errors={errors}
        lang={{
          fullName: lang.fullName,
          email: lang.email,
          institution: lang.institution,
          subjects: lang.subjects,
          subjectsPlaceholder: lang.subjectsPlaceholder,
          bio: lang.bio,
          bioPlaceholder: lang.bioPlaceholder,
          uploadPhoto: lang.uploadPhoto,
          photoHint: lang.photoHint,
          phone: lang.phone,
          whatsapp: lang.whatsapp,
          whatsappHint: lang.whatsappHint,
          whatsappStatus: lang.whatsappStatus,
          connected: lang.connected,
          disconnected: lang.disconnected,
          statusMessage: statusMessage,
          telegram: lang.telegram,
        }}
        isLoading={isLoading}
        whatsappStatus={whatsappStatus}
        statusMessage={statusMessage}
        onInputChange={handleInputChange}
        onPhoneChange={handlePhoneChange}
      />

      <hr className="border-ink/10" />

      <LocationSection
        settings={settings}
        lang={{
          city: lang.city,
          country: lang.country,
          timezone: lang.timezone,
          address: lang.address,
          addressPlaceholder: lang.addressPlaceholder,
          location: lang.location,
        }}
        onInputChange={handleInputChange}
      />

      <hr className="border-ink/10" />

      <NotificationPrefs
        notifications={notifications}
        isRTL={isRTL}
        lang={{ notifications: lang.notifications }}
        onToggle={toggleNotification}
      />

      <hr className="border-ink/10" />

      <PreferencesSection
        locale={locale}
        lang={{
          language: lang.language,
          theme: lang.theme,
          light: lang.light,
          dark: lang.dark,
          system: lang.system,
          preferences: lang.preferences,
        }}
      />
    </div>
  );
}
