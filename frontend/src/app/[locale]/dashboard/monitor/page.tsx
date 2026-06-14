'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useEffect, useCallback } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import logger from '@/lib/logger';
import {
  Activity,
  Server,
  Smartphone,
  Database,
  RefreshCw,
  Wifi,
  WifiOff,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { apiClient } from '@/lib/client';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';

interface SystemInfo {
  apiHealthy: boolean;
  apiResponseTime: number;
  dbHealthy: boolean;
  dbResponseTime: number;
  lastChecked: Date;
}

type ServiceStatus = 'healthy' | 'degraded' | 'down';

export default function SystemMonitorPage() {
  const t = useTranslations('monitor');
  const locale = useLocale();
  const { whatsappStatus, refreshStatus } = useWhatsAppStatus();

  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const checkSystemHealth = useCallback(async () => {
    try {
      setChecking(true);

      const [apiResult, dbResult] = await Promise.allSettled([
        (async () => {
          const start = Date.now();
          await apiClient.getDashboardStats();
          return { healthy: true, time: Date.now() - start };
        })(),
        (async () => {
          const start = Date.now();
          await apiClient.getOfferings();
          return { healthy: true, time: Date.now() - start };
        })()
      ]);

      const apiHealthy = apiResult.status === 'fulfilled' && apiResult.value.healthy;
      const apiResponseTime = apiResult.status === 'fulfilled' ? apiResult.value.time : 0;
      const dbHealthy = dbResult.status === 'fulfilled' && dbResult.value.healthy;
      const dbResponseTime = dbResult.status === 'fulfilled' ? dbResult.value.time : 0;

      setSystemInfo({
        apiHealthy,
        apiResponseTime,
        dbHealthy,
        dbResponseTime,
        lastChecked: new Date(),
      });
    } catch (err) {
      logger.error('System health check failed', err);
    } finally {
      setChecking(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        setChecking(true);
        const [apiResult, dbResult] = await Promise.allSettled([
          (async () => {
            const start = Date.now();
            await apiClient.getDashboardStats();
            return { healthy: true, time: Date.now() - start };
          })(),
          (async () => {
            const start = Date.now();
            await apiClient.getOfferings();
            return { healthy: true, time: Date.now() - start };
          })()
        ]);
        if (cancelled) return;
        const apiHealthy = apiResult.status === 'fulfilled' && apiResult.value.healthy;
        const apiResponseTime = apiResult.status === 'fulfilled' ? apiResult.value.time : 0;
        const dbHealthy = dbResult.status === 'fulfilled' && dbResult.value.healthy;
        const dbResponseTime = dbResult.status === 'fulfilled' ? dbResult.value.time : 0;
        setSystemInfo({ apiHealthy, apiResponseTime, dbHealthy, dbResponseTime, lastChecked: new Date() });
      } catch (err) {
        if (!cancelled) logger.error('System health check failed', err);
      } finally {
        if (!cancelled) {
          setChecking(false);
          setLoading(false);
        }
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US');
  };

  const overallStatus: ServiceStatus = systemInfo?.apiHealthy && systemInfo?.dbHealthy
    ? 'healthy'
    : systemInfo?.apiHealthy || systemInfo?.dbHealthy
      ? 'degraded'
      : 'down';

  const whatsappServiceStatus: ServiceStatus =
    whatsappStatus.status === 'connected'
      ? 'healthy'
      : whatsappStatus.status === 'connecting'
        ? 'degraded'
        : 'down';

  const getStatusColor = (status: ServiceStatus) => {
    switch (status) {
      case 'healthy':
        return 'text-success';
      case 'degraded':
        return 'text-warning';
      case 'down':
        return 'text-error';
    }
  };

  const getStatusBadge = (status: ServiceStatus) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-success/10 text-success border-success/20">{t('healthy')}</Badge>;
      case 'degraded':
        return <Badge className="bg-warning/10 text-warning border-warning/20">{t('degraded')}</Badge>;
      case 'down':
        return <Badge className="bg-error/10 text-error border-error/20">{t('down')}</Badge>;
    }
  };

  const getStatusIcon = (status: ServiceStatus) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className={`h-5 w-5 ${getStatusColor(status)}`} />;
      case 'degraded':
        return <AlertTriangle className={`h-5 w-5 ${getStatusColor(status)}`} />;
      case 'down':
        return <XCircle className={`h-5 w-5 ${getStatusColor(status)}`} />;
    }
  };

  if (loading) {
    return <LoadingSpinner message={t('loading')} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            checkSystemHealth();
            refreshStatus();
          }}
          disabled={checking}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${checking ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </PageHeader>

      {/* Overall System Health */}
      <Card className="border-0 shadow-[0_1px_3px_rgba(8,61,68,0.06)]">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                overallStatus === 'healthy'
                  ? 'bg-success/10'
                  : overallStatus === 'degraded'
                    ? 'bg-warning/10'
                    : 'bg-error/10'
              }`}>
                <Activity className={`h-6 w-6 ${getStatusColor(overallStatus)}`} />
              </div>
              <div>
                <p className="text-sm font-medium text-ink/50 font-body uppercase tracking-wider">{t('systemHealth')}</p>
                <p className={`text-2xl font-bold font-display ${getStatusColor(overallStatus)}`}>
                  {overallStatus === 'healthy' ? t('healthy') : overallStatus === 'degraded' ? t('degraded') : t('down')}
                </p>
              </div>
            </div>
            {systemInfo?.lastChecked && (
              <div className="text-right">
                <p className="text-xs text-ink/40 font-mono uppercase tracking-wider">{t('lastChecked')}</p>
                <p className="text-sm font-mono text-ink/60">{formatTime(systemInfo.lastChecked)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Service Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* API Service */}
        <Card className="border-0 shadow-[0_1px_3px_rgba(8,61,68,0.06)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg font-display">
              <div className="flex items-center gap-2">
                <Server className="h-5 w-5 text-primary" />
                {t('apiStatus')}
              </div>
              {getStatusBadge(systemInfo?.apiHealthy ? 'healthy' : 'down')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink/50 font-body">{t('responseTime')}</span>
              <span className="font-mono text-sm font-medium">{systemInfo?.apiResponseTime ?? 0}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink/50 font-body">{t('status')}</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(systemInfo?.apiHealthy ? 'healthy' : 'down')}
                <span className="text-sm font-medium">{systemInfo?.apiHealthy ? t('healthy') : t('down')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Service */}
        <Card className="border-0 shadow-[0_1px_3px_rgba(8,61,68,0.06)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg font-display">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                {t('databaseStatus')}
              </div>
              {getStatusBadge(systemInfo?.dbHealthy ? 'healthy' : 'down')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink/50 font-body">{t('responseTime')}</span>
              <span className="font-mono text-sm font-medium">{systemInfo?.dbResponseTime ?? 0}ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink/50 font-body">{t('status')}</span>
              <div className="flex items-center gap-2">
                {getStatusIcon(systemInfo?.dbHealthy ? 'healthy' : 'down')}
                <span className="text-sm font-medium">{systemInfo?.dbHealthy ? t('healthy') : t('down')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Service */}
        <Card className="border-0 shadow-[0_1px_3px_rgba(8,61,68,0.06)]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg font-display">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                {t('whatsappStatus')}
              </div>
              {getStatusBadge(whatsappServiceStatus)}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink/50 font-body">{t('connection')}</span>
              <div className="flex items-center gap-2">
                {whatsappStatus.status === 'connected' ? (
                  <Wifi className="h-4 w-4 text-success" />
                ) : (
                  <WifiOff className="h-4 w-4 text-error" />
                )}
                <span className="text-sm font-medium">
                  {whatsappStatus.status === 'connected' ? t('connected') : t('disconnected')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
