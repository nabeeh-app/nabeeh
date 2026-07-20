'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, Phone, MessageCircle, Loader2, CheckCircle, XCircle } from 'lucide-react';

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

interface ProfileFormProps {
  settings: TeacherSettings;
  errors: Record<string, string>;
  locale: string;
  isLoading: boolean;
  whatsappStatus: 'unknown' | 'connected' | 'disconnected';
  statusMessage: string;
  onInputChange: (field: keyof TeacherSettings, value: string | string[]) => void;
  onPhoneChange: (field: 'phone' | 'whatsapp_number', value: string) => void;
}

export default function ProfileForm({
  settings,
  errors,
  locale: _locale,
  isLoading,
  whatsappStatus,
  statusMessage,
  onInputChange,
  onPhoneChange,
}: ProfileFormProps) {
  const t = useTranslations('settings');
  return (
    <>
      {/* Profile */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink font-display">{t('profileSection')}</h2>

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
              {t('uploadPhoto')}
            </Button>
            <p className="text-xs text-ink/60 font-body uppercase tracking-wider">
              {t('photoHint')}
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">{t('fullName')} *</Label>
            <Input
              id="fullName"
              value={settings.name}
              onChange={(e) => onInputChange('name', e.target.value)}
              className={errors.name ? 'border-destructive' : ''}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('email')} *</Label>
            <Input
              id="email"
              type="email"
              dir="ltr"
              className={errors.email ? 'border-destructive' : ''}
              value={settings.email}
              onChange={(e) => onInputChange('email', e.target.value)}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="businessName">{t('institution')}</Label>
            <Input
              id="businessName"
              value={settings.business_name}
              onChange={(e) => onInputChange('business_name', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subjects">{t('subjects')}</Label>
            <Input
              id="subjects"
              value={settings.subjects.join(', ')}
              onChange={(e) => onInputChange('subjects', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder={t('subjectsPlaceholder')}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio">{t('bio')}</Label>
          <Textarea
            id="bio"
            value={settings.bio}
            onChange={(e) => onInputChange('bio', e.target.value)}
            placeholder={t('bioPlaceholder')}
            rows={2}
          />
        </div>
      </section>

      <hr className="border-ink/10" />

      {/* Contact */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink font-display">{t('contactSection')}</h2>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="gap-1.5 inline-flex items-center">
              <Phone className="h-3.5 w-3.5" />
              {t('phone')} *
            </Label>
            <Input
              id="phone"
              dir="ltr"
              value={settings.phone}
              onChange={(e) => onPhoneChange('phone', e.target.value)}
              placeholder={t('phonePlaceholder')}
              className={errors.phone ? 'border-destructive' : ''}
            />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp" className="gap-1.5 inline-flex items-center">
              <MessageCircle className="h-3.5 w-3.5" />
              {t('whatsapp')}
            </Label>
            <Input
              id="whatsapp"
              dir="ltr"
              value={settings.whatsapp_number}
              onChange={(e) => onPhoneChange('whatsapp_number', e.target.value)}
              placeholder={settings.phone || "+201234567890"}
              className={errors.whatsapp_number ? 'border-destructive' : ''}
            />
            {errors.whatsapp_number && <p className="text-sm text-destructive">{errors.whatsapp_number}</p>}
            <p className="text-xs text-ink/60 font-body uppercase tracking-wider">
              {t('whatsappHint')}
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
          <span className="font-medium">{t('whatsappStatus')}</span>
          <span className={`text-ink/60 ${whatsappStatus === 'connected' ? 'text-primary' : 'text-destructive'}`}>
            {whatsappStatus === 'connected' ? t('connected') : t('disconnected')}
          </span>
          {statusMessage && (
            <span className="text-ink/50">- {statusMessage}</span>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="telegram">{t('telegram')}</Label>
          <Input
            id="telegram"
            value={settings.telegram_username}
            onChange={(e) => onInputChange('telegram_username', e.target.value)}
            placeholder="@username"
          />
        </div>
      </section>
    </>
  );
}
