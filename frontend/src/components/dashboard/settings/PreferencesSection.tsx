'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PreferencesSectionProps {
  locale: string;
  lang: { language: string; theme: string; light: string; dark: string; system: string; preferences: string };
}

export default function PreferencesSection({
  locale,
  lang,
}: PreferencesSectionProps) {
  return (
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
  );
}
