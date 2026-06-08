'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useMemo } from 'react';
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';
import { sendWhatsAppMessage } from '@/lib/utils';
import apiClient from '@/lib/api';

export default function WhatsAppDashboardPage() {
  const t = useTranslations('whatsapp');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const { whatsappStatus, refreshStatus } = useWhatsAppStatus();
  const [isLoading, setIsLoading] = useState(false);
  const [isPairing, setIsPairing] = useState(false);

  const statusDetails = useMemo(() => {
    const detailsMap: Record<string, { title: string; description: string }> = {
      connected: {
        title: t('statusConnectedTitle'),
        description: t('statusConnectedDescription')
      },
      qr_ready: {
        title: t('statusQrTitle'),
        description: t('statusQrDescription')
      },
      connecting: {
        title: t('statusConnectingTitle'),
        description: t('statusConnectingDescription')
      },
      error: {
        title: t('statusErrorTitle'),
        description: t('statusErrorDescription')
      },
      disconnected: {
        title: t('statusDisconnectedTitle'),
        description: t('statusDisconnectedDescription')
      }
    };

    return detailsMap[whatsappStatus.status] || detailsMap.disconnected;
  }, [t, whatsappStatus.status]);

  const handleLogout = async () => {
    if (!confirm(t('alerts.confirmLogout'))) return;

    setIsLoading(true);
    try {
      const response = await apiClient.api.post('/whatsapp/logout');
      const data = response.data;
      if (data.success) {
        refreshStatus();
      } else {
        alert('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestQrCode = async () => {
    setIsPairing(true);
    try {
      await apiClient.startWhatsAppPairing();
      await refreshStatus();
      setTimeout(refreshStatus, 2000);
    } catch (error) {
      console.error('QR request failed:', error);
      alert(isRTL ? 'فشل في طلب رمز QR' : 'Failed to request QR code');
    } finally {
      setIsPairing(false);
    }
  };

  const testMessage = async () => {
    const testPhone = prompt(t('alerts.enterTestPhoneNumber'));
    if (!testPhone) return;

    setIsLoading(true);
    try {
      const result = await sendWhatsAppMessage(
        testPhone,
        t('alerts.testMessageContent')
      );

      if (result.success) {
        alert(`✅ ${t('alerts.testMessageSent')}`);
      } else {
        alert(`❌ ${t('alerts.testMessageFailed')}: ` + result.message);
      }
    } catch (error) {
      alert(`❌ ${t('alerts.errorSendingTest')}: ` + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const statusSummary = useMemo(() => {
    const toneMap: Record<string, { label: string; tone: string }> = {
      connected: { label: t('connected'), tone: 'text-green-700 bg-green-50' },
      qr_ready: { label: t('scanQR'), tone: 'text-primary bg-primary/10' },
      connecting: { label: t('connecting'), tone: 'text-amber-700 bg-amber-50' },
      error: { label: t('error'), tone: 'text-red-700 bg-red-50' },
      disconnected: { label: t('disconnected'), tone: 'text-gray-700 bg-gray-100' }
    };

    const fallback = toneMap.disconnected;
    return toneMap[whatsappStatus.status] || fallback;
  }, [whatsappStatus.status, t]);

  const statusMessage = whatsappStatus.message || statusDetails.description;
  const canRetry = whatsappStatus.status === 'error' || whatsappStatus.status === 'disconnected';

  return (
    <div
      className="space-y-6 w-full max-w-4xl mx-auto text-left"
      dir="ltr"
    >
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold text-gray-900">
          {t('title')}
        </h1>
        <p className="text-sm text-gray-600 max-w-2xl">
          {t('description')}
        </p>
        <Button
          onClick={refreshStatus}
          disabled={whatsappStatus.isLoading}
          variant="outline"
          className="w-fit self-start"
        >
          {whatsappStatus.isLoading ? t('checking') : t('refreshStatus')}
        </Button>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base font-semibold text-gray-900">
                {t('connectionStatus')}
              </CardTitle>
              <p className="text-sm text-gray-500">
                {t('whenDisconnected')}
              </p>
            </div>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${statusSummary.tone}`}>
              {statusSummary.label}
            </span>
            <p className="text-sm text-gray-600">
              {statusMessage}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-4 text-sm text-gray-600">
              <div className="space-y-1">
                <p className="text-gray-500">{t('quickActions')}</p>
                <p className="text-gray-900">{whatsappStatus.sessionExists ? t('connected') : t('disconnected')}</p>
              </div>
              <div className={`rounded-lg px-4 py-3 ${statusSummary.tone}`}>
                <p className="text-sm font-semibold">{statusDetails.title}</p>
                <p className="text-sm">{statusDetails.description}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {whatsappStatus.status !== 'connected' && (
                <Button
                  onClick={requestQrCode}
                  disabled={isPairing}
                  size="sm"
                  variant="default"
                >
                  {isPairing ? t('checking') : t('connectWhatsApp')}
                </Button>
              )}
              {canRetry && (
                <Button
                  onClick={refreshStatus}
                  disabled={whatsappStatus.isLoading}
                  size="sm"
                  variant="outline"
                >
                  {whatsappStatus.isLoading ? t('checking') : t('retryStatus')}
                </Button>
              )}
              {whatsappStatus.status === 'connected' && (
                <>
                  <Button
                    onClick={handleLogout}
                    disabled={isLoading}
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    {t('logout')}
                  </Button>
                  <Button
                    onClick={testMessage}
                    disabled={isLoading}
                    size="sm"
                    variant="secondary"
                  >
                    {t('testMessage')}
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="h-full border-primary/20 bg-primary/5">
          <CardHeader className="space-y-2">
            <CardTitle className="text-base font-semibold text-blue-900">
              {t('scanQR')}
            </CardTitle>
            <p className="text-sm text-blue-700">
              {t('scanWithWhatsApp')}
            </p>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-6">
            {whatsappStatus.qr ? (
              <div className="bg-white p-4 rounded-lg shadow-sm">
                <img src={whatsappStatus.qr} alt="WhatsApp QR Code" className="w-64 h-64" />
              </div>
            ) : (
              <div className="w-full rounded-lg border border-dashed border-blue-200 bg-white p-6 text-center text-sm text-blue-700">
                {whatsappStatus.status === 'qr_ready'
                  ? t('preparingConnection')
                  : t('scanQR')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
