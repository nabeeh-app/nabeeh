'use client';

import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PreferencesSectionProps {
  locale: string;
}

export default function PreferencesSection({
  locale,
}: PreferencesSectionProps) {
  const t = useTranslations('settings');
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-ink font-display">{t('preferences')}</h2>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="language">{t('language')}</Label>
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
          <Label htmlFor="theme">{t('theme')}</Label>
          <Select>
            <SelectTrigger id="theme">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t('light')}</SelectItem>
              <SelectItem value="dark">{t('dark')}</SelectItem>
              <SelectItem value="system">{t('system')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}
