'use client';

import { useState, useEffect } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api';
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
  onReadAll: () => void;
}

export function NotificationPanel({ onClose, onReadAll }: NotificationPanelProps) {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await apiClient.getNotifications({ limit: 20 });
        if (response.success) {
          setNotifications(response.data);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await apiClient.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      onReadAll();
    } catch {
      // Silently fail
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await apiClient.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      onReadAll();
    } catch {
      // Silently fail
    }
  };

  const timeAgo = (dateStr: string) => {
    const now = new Date();
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return t('timeAgo.justNow');
    if (diffMins < 60) return t('timeAgo.minutes', { count: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return t('timeAgo.hours', { count: diffHours });
    const diffDays = Math.floor(diffHours / 24);
    return t('timeAgo.days', { count: diffDays });
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 max-h-[70vh] bg-popover border border-border shadow-lg z-50 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-ink font-display">{t('title')}</h3>
        {notifications.some((n) => !n.is_read) && (
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
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-6 w-6 border-b-2 border-ink" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Bell className="h-8 w-8 text-ink/20 mx-auto mb-2" />
            <p className="text-sm text-ink/50">{t('empty')}</p>
          </div>
        ) : (
          notifications.map((notification) => {
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
                    {timeAgo(notification.created_at)}
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
