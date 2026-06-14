'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Info,
  AlertCircle,
  CheckCheck,
  Filter,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import type { Alert } from '@/types';

const SEVERITY_CONFIG = {
  info: { icon: Info, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  critical: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
} as const;

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function AlertDisplay() {
  const t = useTranslations('alerts');
  const tCommon = useTranslations('common');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const params: Record<string, string | number> = { page, limit: 20 };
    if (severityFilter !== 'all') params.severity = severityFilter;
    if (unreadOnly) params.unread_only = 'true';
    apiClient
      .getAlerts(params)
      .then(res => {
        if (cancelled) return;
        if (res.success) {
          setAlerts(res.data as Alert[]);
          setHasMore(res.pagination.pages > page);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [page, severityFilter, unreadOnly]);

  const handleMarkRead = async (id: string) => {
    try {
      await apiClient.markAlertRead(id);
      setAlerts(prev =>
        prev.map(a => (a.id === id ? { ...a, is_read: true } : a))
      );
    } catch {
      // silent
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.markAllAlertsRead();
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    } catch {
      // silent
    }
  };

  const unreadCount = alerts.filter(a => !a.is_read).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-ink font-display">
          <Bell className="h-5 w-5" />
          {t('title')}
          {unreadCount > 0 && (
            <Badge variant="destructive" className="ml-2">
              {unreadCount}
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck className="h-4 w-4 mr-1" />
              {t('markAllRead')}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-ink/50" />
          <Select
            value={severityFilter}
            onValueChange={val => {
              setSeverityFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allSeverities')}</SelectItem>
              <SelectItem value="info">{t('severityInfo')}</SelectItem>
              <SelectItem value="warning">{t('severityWarning')}</SelectItem>
              <SelectItem value="critical">{t('severityCritical')}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={unreadOnly ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setUnreadOnly(prev => !prev);
              setPage(1);
            }}
          >
            {t('unreadOnly')}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-b-2 border-ink mx-auto" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-ink/60 font-body">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{t('noAlerts')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map(alert => {
              const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
              const Icon = config.icon;
              return (
                <button
                  key={alert.id}
                  onClick={() => !alert.is_read && handleMarkRead(alert.id)}
                  className={`w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    alert.is_read
                      ? 'border-border bg-canvas opacity-60'
                      : 'border-border bg-surface-sage/20 hover:bg-surface-sage/30'
                  }`}
                >
                  <div className={`shrink-0 p-1.5 rounded-full ${config.bg}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink text-sm font-body">
                        {alert.title}
                      </span>
                      {!alert.is_read && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-ink/70 font-body mt-0.5 line-clamp-2">
                      {alert.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {t(`severity.${alert.severity}`)}
                      </Badge>
                      <span className="text-xs text-ink/50 font-body">
                        {timeAgo(alert.created_at)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center mt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(prev => prev + 1)}
            >
              {tCommon('loadMore')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
