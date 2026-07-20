'use client';

import { useTranslations } from 'next-intl';
import { Switch } from '@/components/ui/switch';

interface NotificationPref {
  key: string;
  label: string;
  enabled: boolean;
}

interface NotificationPrefsProps {
  notifications: NotificationPref[];
  onToggle: (key: string) => void;
}

export default function NotificationPrefs({
  notifications,
  onToggle,
}: NotificationPrefsProps) {
  const t = useTranslations('settings');
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-ink font-display">{t('notifications')}</h2>

      <div className="divide-y divide-ink/10">
        {notifications.map((item) => (
          <div key={item.key} className="flex items-center justify-between py-3">
            <span className="text-sm text-ink">{item.label}</span>
            <Switch
              checked={item.enabled}
              onCheckedChange={() => onToggle(item.key)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
