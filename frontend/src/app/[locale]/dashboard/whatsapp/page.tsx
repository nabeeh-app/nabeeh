'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState, useMemo } from 'react';
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';
import { sendWhatsAppMessage } from '@/lib/utils';
import apiClient from '@/lib/client';
import logger from '@/lib/logger';
import {
  QrCode,
  RefreshCw,
  Link2,
  Unlink,
  MessageSquare,
  Loader2,
  CheckCircle,
  XCircle,
  Smartphone,
  AlertCircle,
} from 'lucide-react';

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

export default function WhatsAppDashboardPage() {
  const t = useTranslations('whatsapp');
  const tc = useTranslations('common');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const { whatsappStatus, refreshStatus } = useWhatsAppStatus();
  const [isLoading, setIsLoading] = useState(false);
  const [isPairing, setIsPairing] = useState(false);

  const [alertDialog, setAlertDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm?: () => void;
    variant?: 'default' | 'destructive';
  }>({ open: false, title: '', description: '' });

  const handleLogout = async () => {
    setAlertDialog({
      open: true,
      title: t('logout'),
      description: t('alerts.confirmLogout'),
      variant: 'destructive',
      onConfirm: async () => {
        setIsLoading(true);
        try {
          const response = await apiClient.api.post('/whatsapp/logout');
          const data = response.data;
          if (data.success) {
            refreshStatus();
          } else {
            setAlertDialog({
              open: true,
              title: t('alerts.logoutFailed'),
              description: t('alerts.logoutFailed'),
            });
          }
        } catch (error) {
          logger.error('Logout error:', error);
        } finally {
          setIsLoading(false);
        }
      },
    });
  };

  const requestQrCode = async () => {
    if (isMockMode) {
      setAlertDialog({
        open: true,
        title: isRTL ? 'وضع العرض التجريبي' : 'Mock Mode',
        description: isRTL
          ? 'الواتساب غير متاح في وضع العرض التجريبي. عيّن NEXT_PUBLIC_USE_MOCK=false وأعد تشغيل الخادم.'
          : 'WhatsApp is unavailable in mock mode. Set NEXT_PUBLIC_USE_MOCK=false and restart the dev server.',
      });
      return;
    }
    setIsPairing(true);
    try {
      await apiClient.startWhatsAppPairing();
      await refreshStatus();
      setTimeout(refreshStatus, 2000);
    } catch (error) {
      logger.error('QR request failed:', error);
      setAlertDialog({
        open: true,
        title: t('alerts.qrRequestFailed'),
        description: t('alerts.qrRequestFailed'),
      });
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
        setAlertDialog({
          open: true,
          title: t('alerts.testMessageSent'),
          description: t('alerts.testMessageSent'),
        });
      } else {
        setAlertDialog({
          open: true,
          title: t('alerts.testMessageFailed'),
          description: `${t('alerts.testMessageFailed')}: ${result.message}`,
        });
      }
    } catch (error) {
      setAlertDialog({
        open: true,
        title: t('alerts.errorSendingTest'),
        description: `${t('alerts.errorSendingTest')}: ${(error as Error).message}`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isConnected = whatsappStatus.status === 'connected';
  const isDisconnected = whatsappStatus.status === 'disconnected' || whatsappStatus.status === 'error';
  const hasQr = !!whatsappStatus.qr;
  const isPreparing = whatsappStatus.status === 'qr_ready' && !hasQr;
  const isTransitioning = whatsappStatus.status === 'connecting';

  return (
    <div className="space-y-6 w-full max-w-2xl mx-auto">
      {/* Page header */}
      <section className="space-y-1">
        <h1 className="text-3xl font-semibold text-ink font-display">
          {t('title')}
        </h1>
        <p className="text-sm text-ink/60 font-body">
          {t('description')}
        </p>
      </section>

      {isMockMode && (
        <div className="flex items-start gap-3 p-4 bg-[#e5ff97]/30 border border-[#e5ff97]/50 rounded-lg">
          <AlertCircle className="h-4 w-4 text-ink/60 mt-0.5 shrink-0" />
          <div className="text-sm text-ink/70 font-body">
            <p className="font-medium text-ink">{isRTL ? 'وضع العرض التجريبي' : 'Mock Mode Active'}</p>
            <p className="mt-1">{isRTL ? 'الواتساب غير متاح في وضع العرض التجريبي. عيّن NEXT_PUBLIC_USE_MOCK=false في .local.env وأعد تشغيل الخادم.' : 'WhatsApp is unavailable in mock mode. Set NEXT_PUBLIC_USE_MOCK=false in .env.local and restart the dev server.'}</p>
          </div>
        </div>
      )}

      {/* Connected state — compact card with actions */}
      {isConnected && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-surface-sage flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-[#026370]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">{t('statusConnectedTitle')}</p>
                <p className="text-xs text-ink/50 font-body">{t('statusConnectedDescription')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={testMessage}
                  disabled={isLoading}
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {t('testMessage')}
                </Button>
                <Button
                  onClick={handleLogout}
                  disabled={isLoading}
                  size="sm"
                  variant="outline"
                  className="gap-1.5 border-[#c53030]/20 text-[#c53030] hover:bg-[#c53030]/10"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  {t('logout')}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disconnected / transitioning / error — main connection flow */}
      {!isConnected && (
        <>
          {/* Connection card — status + primary action */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-ink font-display flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-ink/40" />
                {t('connectionStatus')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Primary action — large, prominent */}
              {(isDisconnected || hasQr) && (
                <Button
                  onClick={requestQrCode}
                  disabled={isPairing || isTransitioning}
                  className="w-full gap-2 h-11"
                  size="lg"
                >
                  {isPairing || isTransitioning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('checking')}
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4" />
                      {t('connectWhatsApp')}
                    </>
                  )}
                </Button>
              )}

              {isPreparing && (
                <div className="flex items-center gap-2 text-sm text-ink/60">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('preparingConnection')}
                </div>
              )}

              {/* Error state — only shown on actual errors */}
              {whatsappStatus.status === 'error' && (
                <div className="flex items-start gap-3 p-3 bg-[#c53030]/5 border border-[#c53030]/10 rounded-lg">
                  <AlertCircle className="h-4 w-4 text-[#c53030] mt-0.5 shrink-0" />
                  <p className="text-sm text-[#c53030]">{t('statusErrorDescription')}</p>
                </div>
              )}

              {/* Refresh — secondary, inline */}
              <div className="flex justify-end">
                <Button
                  onClick={refreshStatus}
                  disabled={whatsappStatus.isLoading}
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-ink/50 hover:text-ink"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${whatsappStatus.isLoading ? 'animate-spin' : ''}`} />
                  {whatsappStatus.isLoading ? t('checking') : t('refreshStatus')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* QR Code + Steps — side by side on large screens */}
          <Card className="border-primary/10">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* Steps */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-ink font-display">
                    {t('connectionStepsTitle')}
                  </h3>
                  <ol className="space-y-3 text-sm text-ink/70 font-body list-none">
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">1</span>
                      <span>{t('stepOpenWhatsApp')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">2</span>
                      <span>{t('stepGoToLinkedDevices')}</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">3</span>
                      <span>{t('stepScanQR')}</span>
                    </li>
                  </ol>
                </div>

                {/* QR Code display area */}
                <div className="flex items-center justify-center">
                  {hasQr ? (
                    <div className="bg-canvas p-4 rounded-lg border border-ink/10">
                      <img
                        src={whatsappStatus.qr ?? undefined}
                        alt="WhatsApp QR Code"
                        className="w-56 h-56"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-56 rounded-lg border border-dashed border-ink/15 bg-surface-cool/30 flex flex-col items-center justify-center gap-3">
                      <QrCode className="h-10 w-10 text-ink/20" />
                      <p className="text-xs text-ink/40 font-body text-center px-4">
                        {t('qrWillAppearHere')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{alertDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={alertDialog.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => {
                alertDialog.onConfirm?.();
                setAlertDialog(prev => ({ ...prev, open: false }));
              }}
            >
              {tc('confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
