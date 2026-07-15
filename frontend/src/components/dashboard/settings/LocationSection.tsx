'use client';

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
  lang: { city: string; country: string; timezone: string; address: string; addressPlaceholder: string; location: string };
  onInputChange: (field: keyof TeacherSettings, value: string | string[]) => void;
}

export default function LocationSection({
  settings,
  lang,
  onInputChange,
}: LocationSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-ink font-display">{lang.location}</h2>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="city">{lang.city}</Label>
          <Input
            id="city"
            value={settings.city}
            onChange={(e) => onInputChange('city', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="country">{lang.country}</Label>
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
            {lang.timezone}
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
          <Label htmlFor="address">{lang.address}</Label>
          <Input
            id="address"
            value={settings.address}
            onChange={(e) => onInputChange('address', e.target.value)}
            placeholder={lang.addressPlaceholder}
          />
        </div>
      </div>
    </section>
  );
}
