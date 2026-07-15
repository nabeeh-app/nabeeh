'use client';

import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock } from 'lucide-react';

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

const TIMEZONES = [
  { value: 'Africa/Cairo', label: 'Africa/Cairo (GMT+2)' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (GMT+3)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GMT+4)' },
  { value: 'Europe/London', label: 'Europe/London (GMT+0)' },
  { value: 'America/New_York', label: 'America/New_York (GMT-5)' },
] as const;

interface LocationSectionProps {
  settings: TeacherSettings;
  onInputChange: (field: keyof TeacherSettings, value: string | string[]) => void;
}

export default function LocationSection({
  settings,
  onInputChange,
}: LocationSectionProps) {
  const t = useTranslations('settings');
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-ink font-display">{t('location')}</h2>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="city">{t('city')}</Label>
          <Input
            id="city"
            value={settings.city}
            onChange={(e) => onInputChange('city', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">{t('country')}</Label>
          <Input
            id="country"
            value={settings.country}
            onChange={(e) => onInputChange('country', e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="timezone" className="gap-1.5 inline-flex items-center">
            <Clock className="h-3.5 w-3.5" />
            {t('timezone')}
          </Label>
          <Select
            value={settings.timezone}
            onValueChange={(value) => onInputChange('timezone', value)}
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
          <Label htmlFor="address">{t('address')}</Label>
          <Input
            id="address"
            value={settings.address}
            onChange={(e) => onInputChange('address', e.target.value)}
            placeholder={t('addressPlaceholder')}
          />
        </div>
      </div>
    </section>
  );
}
