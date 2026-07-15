'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload } from 'lucide-react';

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
  lang: { fullName: string; email: string; institution: string; subjects: string; subjectsPlaceholder: string; bio: string; bioPlaceholder: string; uploadPhoto: string; photoHint: string; phone: string; whatsapp: string; whatsappHint: string; whatsappStatus: string; connected: string; disconnected: string; statusMessage: string; telegram: string };
  isLoading: boolean;
  whatsappStatus: 'unknown' | 'connected' | 'disconnected';
  statusMessage: string;
  onInputChange: (field: keyof TeacherSettings, value: string | string[]) => void;
  onPhoneChange: (field: 'phone' | 'whatsapp_number', value: string) => void;
}

export default function ProfileForm({
  settings,
  errors,
  lang,
  isLoading,
  whatsappStatus,
  statusMessage,
  onInputChange,
  onPhoneChange,
}: ProfileFormProps) {
  return (
    <>
      {/* Profile */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink font-display">{lang.fullName.split(' ')[0] === 'Full' ? 'Profile' : 'الملف الشخصي'}</h2>

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
              onChange={(e) => onInputChange('name', e.target.value)}
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
              onChange={(e) => onInputChange('email', e.target.value)}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="businessName">{lang.institution}</Label>
            <Input
              id="businessName"
              value={settings.business_name}
              onChange={(e) => onInputChange('business_name', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="subjects">{lang.subjects}</Label>
            <Input
              id="subjects"
              value={settings.subjects.join(', ')}
              onChange={(e) => onInputChange('subjects', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
              placeholder={lang.subjectsPlaceholder}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bio">{lang.bio}</Label>
          <Textarea
            id="bio"
            value={settings.bio}
            onChange={(e) => onInputChange('bio', e.target.value)}
            placeholder={lang.bioPlaceholder}
            rows={2}
          />
        </div>
      </section>

      <hr className="border-ink/10" />

      {/* Contact */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink font-display">{lang.phone.split(' ')[0] === 'Phone' ? 'Contact' : 'التواصل'}</h2>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="gap-1.5 inline-flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              {lang.phone} *
            </Label>
            <Input
              id="phone"
              dir="ltr"
              value={settings.phone}
              onChange={(e) => onPhoneChange('phone', e.target.value)}
              placeholder="+201234567890"
              className={errors.phone ? 'border-destructive' : ''}
            />
            {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="whatsapp" className="gap-1.5 inline-flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
              {lang.whatsapp}
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
            <p className="text-xs text-ink/60 font-mono uppercase tracking-wider">
              {lang.whatsappHint}
            </p>
          </div>
        </div>

        {/* WhatsApp status — compact single row */}
        <div className="flex items-center gap-2 text-sm">
          {isLoading ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-ink/40"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          ) : whatsappStatus === 'connected' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
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
            onChange={(e) => onInputChange('telegram_username', e.target.value)}
            placeholder="@username"
          />
        </div>
      </section>
    </>
  );
}
