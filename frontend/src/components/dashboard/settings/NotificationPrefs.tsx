'use client';

import { useTranslations } from 'next-intl';

interface NotificationPref {
  key: string;
  label: string;
  enabled: boolean;
}

interface NotificationPrefsProps {
  notifications: NotificationPref[];
  isRTL: boolean;
  onToggle: (key: string) => void;
}

export default function NotificationPrefs({
  notifications,
  isRTL,
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
            <button
              type="button"
              onClick={() => onToggle(item.key)}
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
  );
}
