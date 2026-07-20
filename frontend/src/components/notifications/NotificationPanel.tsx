'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import {
  Bell,
  CheckCheck,
  Clock,
  MessageSquare,
  GraduationCap,
  UserPlus,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import { timeAgo } from '@/lib/utils';
import type { Notification } from '@/types';

const NOTIFICATION_ICONS: Record<string, typeof Bell> = {
  attendance_marked: Clock,
  grade_entered: GraduationCap,
  whatsapp_sent: MessageSquare,
  assistant_action: UserPlus,
  report_ready: FileText,
  digest: Bell,
  alert: AlertTriangle,
};

interface NotificationPanelProps {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const { data: response, isLoading } = useNotifications({ limit: 20 });
  const notifications = response?.data ?? [];
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  const handleMarkRead = (id: string) => {
    markRead.mutate(id);
  };

  return (
    <div className="absolute end-0 top-full mt-2 w-80 max-h-[70vh] bg-popover border border-border shadow-lg z-50 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-ink font-display">{t('title')}</h3>
        {notifications.some((n: Notification) => !n.is_read) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            className="text-xs gap-1"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {t('markAllRead')}
          </Button>
        )}
      </div>

      <div className="overflow-y-auto max-h-[50vh]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-b-2 border-ink" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Bell className="h-8 w-8 text-ink/20 mx-auto mb-2" />
            <p className="text-sm text-ink/50">{t('empty')}</p>
          </div>
        ) : (
          notifications.map((notification: Notification) => {
            const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
            return (
              <div
                key={notification.id}
                className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-surface-sage/50 transition-colors ${
                  !notification.is_read ? 'bg-surface-sage/30' : ''
                }`}
                onClick={() => handleMarkRead(notification.id)}
              >
                <div className={`mt-0.5 p-1.5 rounded-full ${
                  !notification.is_read ? 'bg-primary/10' : 'bg-surface-cool'
                }`}>
                  <Icon className={`h-4 w-4 ${
                    !notification.is_read ? 'text-primary' : 'text-ink/40'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium text-ink truncate ${
                    !notification.is_read ? '' : 'opacity-70'
                  }`}>
                    {notification.title}
                  </p>
                  {notification.body && (
                    <p className="text-xs text-ink/50 mt-0.5 line-clamp-2">
                      {notification.body}
                    </p>
                  )}
                  <p className="text-xs text-ink/40 mt-1">
                    {timeAgo(notification.created_at, undefined, t as unknown as (key: string, params?: Record<string, unknown>) => string)}
                  </p>
                </div>
                {!notification.is_read && (
                  <div className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="px-4 py-2 border-t border-border">
        <Link
          href={`/${locale}/dashboard/notifications`}
          onClick={onClose}
          className="block text-center text-sm text-primary hover:underline"
        >
          {t('viewAll')}
        </Link>
      </div>
    </div>
  );
}
