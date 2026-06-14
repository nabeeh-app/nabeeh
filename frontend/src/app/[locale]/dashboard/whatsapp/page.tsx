'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useState } from 'react';
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
  Smartphone,
  AlertCircle,
  Phone,
  Copy,
  Check,
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
  const [pairingMode, setPairingMode] = useState<'qr' | 'code'>('qr');
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

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
          const data = await apiClient.logoutWhatsApp();
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

  const requestPairingCode = async () => {
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
    if (!pairingPhone) {
      setAlertDialog({
        open: true,
        title: isRTL ? 'رقم الهاتف مطلوب' : 'Phone number required',
        description: isRTL ? 'أدخل رقم الهاتف أولاً' : 'Please enter your phone number first',
      });
      return;
    }
    setIsPairing(true);
    try {
      const result = await apiClient.requestWhatsAppPairingCode(pairingPhone);
      setPairingCode(result.code);
    } catch (error) {
      logger.error('Pairing code request failed:', error);
      setAlertDialog({
        open: true,
        title: t('alerts.qrRequestFailed'),
        description: isRTL ? 'فشل في توليد كود الإقران' : 'Failed to generate pairing code',
      });
    } finally {
      setIsPairing(false);
    }
  };

  const copyCode = async () => {
    if (pairingCode) {
      await navigator.clipboard.writeText(pairingCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const testMessage = async () => {
    const phone = whatsappStatus.phone;
    if (!phone) return;

    setIsLoading(true);
    try {
      const result = await sendWhatsAppMessage(
        phone,
        t('alerts.testMessageContent')
      );

      if (result.success) {
        setAlertDialog({
          open: true,
          title: t('alerts.testMessageSent'),
          description: '',
        });
        setTimeout(() => setAlertDialog(prev => ({ ...prev, open: false })), 3000);
      } else {
        setAlertDialog({
          open: true,
          title: t('alerts.testMessageFailed'),
          description: result.message,
        });
      }
    } catch (error) {
      setAlertDialog({
        open: true,
        title: t('alerts.errorSendingTest'),
        description: (error as Error).message,
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
              {/* Pairing mode selector */}
              {(isDisconnected || hasQr) && !pairingCode && (
                <div className="flex gap-2 p-1 bg-surface-cool/50 rounded-lg">
                  <button
                    onClick={() => setPairingMode('qr')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                      pairingMode === 'qr'
                        ? 'bg-white text-ink shadow-sm'
                        : 'text-ink/60 hover:text-ink'
                    }`}
                  >
                    <QrCode className="h-4 w-4" />
                    {isRTL ? 'رمز QR' : 'QR Code'}
                  </button>
                  <button
                    onClick={() => setPairingMode('code')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                      pairingMode === 'code'
                        ? 'bg-white text-ink shadow-sm'
                        : 'text-ink/60 hover:text-ink'
                    }`}
                  >
                    <Phone className="h-4 w-4" />
                    {isRTL ? 'كود الإقران' : 'Pairing Code'}
                  </button>
                </div>
              )}

              {/* QR Code mode */}
              {pairingMode === 'qr' && !pairingCode && (
                <>
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
                </>
              )}

              {/* Pairing Code mode */}
              {pairingMode === 'code' && !pairingCode && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      type="tel"
                      placeholder={isRTL ? '+201XXXXXXXXX' : '+201XXXXXXXXX'}
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      className="flex-1"
                      dir="ltr"
                    />
                    <Button
                      onClick={requestPairingCode}
                      disabled={isPairing || isTransitioning || !pairingPhone}
                      className="gap-2"
                    >
                      {isPairing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Phone className="h-4 w-4" />
                      )}
                      {isRTL ? 'توليد الكود' : 'Generate Code'}
                    </Button>
                  </div>
                  <p className="text-xs text-ink/50 text-center">
                    {isRTL
                      ? 'أدخل رقم هاتفك المسجل في واتساب'
                      : 'Enter your WhatsApp-registered phone number'}
                  </p>
                </div>
              )}

              {/* Pairing Code Display */}
              {pairingCode && (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-ink/60 mb-2">
                      {isRTL ? 'أدخل هذا الكود في واتساب:' : 'Enter this code in WhatsApp:'}
                    </p>
                    <div className="flex items-center justify-center gap-2">
                      <div className="text-3xl font-mono font-bold tracking-[0.3em] text-ink bg-surface-cool/50 px-6 py-4 rounded-lg border border-ink/10">
                        {pairingCode}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={copyCode}
                        className="h-10 w-10 p-0"
                      >
                        {codeCopied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setPairingCode(null);
                      setPairingPhone('');
                    }}
                  >
                    {isRTL ? 'إقران بـ QR بدلاً من ذلك' : 'Use QR Code Instead'}
                  </Button>
                </div>
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
          {pairingMode === 'qr' && !pairingCode && (
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
          )}

          {/* Pairing Code Steps */}
          {pairingMode === 'code' && !pairingCode && (
            <Card className="border-primary/10">
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold text-ink font-display mb-4">
                  {isRTL ? 'خطوات الإقران بالكود' : 'Pairing Code Steps'}
                </h3>
                <ol className="space-y-3 text-sm text-ink/70 font-body list-none">
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">1</span>
                    <span>{isRTL ? 'افتح واتساب على هاتفك' : 'Open WhatsApp on your phone'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">2</span>
                    <span>{isRTL ? 'اذهب إلى الأجهزة المرتبطة' : 'Go to Linked Devices'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">3</span>
                    <span>{isRTL ? 'اختر "الإقران برقم الهاتف"' : 'Choose "Link with Phone Number"'}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">4</span>
                    <span>{isRTL ? 'أدخل الكود أعلاه' : 'Enter the code shown above'}</span>
                  </li>
                </ol>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent dir={isRTL ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
            {alertDialog.description && (
              <AlertDialogDescription>{alertDialog.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            {alertDialog.onConfirm ? (
              <>
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
              </>
            ) : (
              <AlertDialogAction onClick={() => setAlertDialog(prev => ({ ...prev, open: false }))}>
                {tc('ok')}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
