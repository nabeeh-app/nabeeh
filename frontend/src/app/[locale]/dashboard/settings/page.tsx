'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { formatPhoneNumber, validateEmail } from '@/lib/utils';
import { Save, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/client';
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

function mapTeacherToSettings(teacher: { name?: string; email?: string; phone?: string; whatsapp_number?: string | null; business_name?: string | null; bio?: string | null; subjects?: string[] | null; address?: string | null; city?: string | null; country?: string | null; timezone?: string | null; telegram_username?: string | null } | null): TeacherSettings {
  return {
    name: teacher?.name || '',
    email: teacher?.email || '',
    phone: teacher?.phone || '',
    whatsapp_number: teacher?.whatsapp_number || teacher?.phone || '',
    business_name: teacher?.business_name || '',
    bio: teacher?.bio || '',
    subjects: teacher?.subjects || [],
    address: teacher?.address || '',
    city: teacher?.city || '',
    country: teacher?.country || 'Egypt',
    timezone: teacher?.timezone || 'Africa/Cairo',
    telegram_username: teacher?.telegram_username || ''
  };
}

export default function SettingsPage() {
  const params = useParams();
  const locale = params.locale as string;
  const { teacher, updateProfile } = useAuth();
  const t = useTranslations('settings');

  const [settings, setSettings] = useState<TeacherSettings>(() => mapTeacherToSettings(null));

  // Reset form when teacher loads or changes (render-phase reset)
  const [prevTeacherId, setPrevTeacherId] = useState<string | null>(null);
  if (teacher?.id !== prevTeacherId) {
    setPrevTeacherId(teacher?.id ?? null);
    setSettings(mapTeacherToSettings(teacher));
  }

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [notifications, setNotifications] = useState<NotificationPref[]>([
    { key: 'attendance', label: t('notifAttendance'), enabled: true },
    { key: 'grades', label: t('notifGrades'), enabled: true },
    { key: 'parent_messages', label: t('notifParentMessages'), enabled: true },
    { key: 'assignments', label: t('notifAssignments'), enabled: false },
    { key: 'system', label: t('notifSystem'), enabled: true },
  ]);

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
          setStatusMessage(t('whatsappDisconnected'));
        }
      } else {
        setWhatsappStatus('disconnected');
        setStatusMessage(t('checkFailed'));
      }
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      logger.error('WhatsApp status check failed:', error);
      if (err.response?.status !== 401) {
        setWhatsappStatus('disconnected');
        setStatusMessage(t('checkFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [settings.whatsapp_number, t]);

  useEffect(() => {
    void (async () => {
      await checkWhatsAppStatus();
    })();
  }, [checkWhatsAppStatus, debouncedWhatsappNumber]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!settings.name.trim()) {
      newErrors.name = t('nameRequired');
    }

    if (!settings.email.trim()) {
      newErrors.email = t('emailRequired');
    } else if (!validateEmail(settings.email)) {
      newErrors.email = t('emailInvalid');
    }

    if (!settings.phone.trim()) {
      newErrors.phone = t('phoneRequired');
    } else if (!/^\+\d{10,15}$/.test(settings.phone)) {
      newErrors.phone = t('phoneInvalid');
    }

    if (settings.whatsapp_number && !/^\+\d{10,15}$/.test(settings.whatsapp_number)) {
      newErrors.whatsapp_number = t('whatsappInvalid');
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

      setMessage({ type: 'success', text: t('savedSuccess') });
      checkWhatsAppStatus();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      logger.error('Save settings error:', error);
      setMessage({
        type: 'error',
        text: err?.response?.data?.message || t('saveError')
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
        <PageHeader title={t('title')} description={t('description')}>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('save')}
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
        locale={locale}
        isLoading={isLoading}
        whatsappStatus={whatsappStatus}
        statusMessage={statusMessage}
        onInputChange={handleInputChange}
        onPhoneChange={handlePhoneChange}
      />

      <hr className="border-ink/10" />

      <LocationSection
        settings={settings}
        onInputChange={handleInputChange}
      />

      <hr className="border-ink/10" />

      <NotificationPrefs
        notifications={notifications}
        onToggle={toggleNotification}
      />

      <hr className="border-ink/10" />

      <PreferencesSection
        locale={locale}
      />
    </div>
  );
}
