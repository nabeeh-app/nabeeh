'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { QrCode, RefreshCw, Link2, Loader2, Phone, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import apiClient from '@/lib/client';
import logger from '@/lib/logger';

interface WhatsAppPairingProps {
  isDisconnected: boolean;
  hasQr: boolean;
  isPreparing: boolean;
  isTransitioning: boolean;
  isPairing: boolean;
  whatsappQr: string | null;
  onRefreshStatus: () => void;
  onAlert: (alert: { open: boolean; title: string; description: string; variant?: 'default' | 'destructive' }) => void;
}

export default function WhatsAppPairing({
  isDisconnected,
  hasQr,
  isPreparing,
  isTransitioning,
  isPairing,
  whatsappQr,
  onRefreshStatus,
  onAlert,
}: WhatsAppPairingProps) {
  const t = useTranslations('whatsapp');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const [pairingMode, setPairingMode] = useState<'qr' | 'code'>('qr');
  const [pairingPhone, setPairingPhone] = useState('');
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

  const requestQrCode = async () => {
    if (isMockMode) {
      onAlert({
        open: true,
        title: isRTL ? 'وضع العرض التجريبي' : 'Mock Mode',
        description: isRTL
          ? 'الواتساب غير متاح في وضع العرض التجريبي. عيّن NEXT_PUBLIC_USE_MOCK=false وأعد تشغيل الخادم.'
          : 'WhatsApp is unavailable in mock mode. Set NEXT_PUBLIC_USE_MOCK=false and restart the dev server.',
      });
      return;
    }
    try {
      await apiClient.startWhatsAppPairing();
      await onRefreshStatus();
      setTimeout(onRefreshStatus, 2000);
    } catch (error) {
      logger.error('QR request failed:', error);
      onAlert({
        open: true,
        title: t('alerts.qrRequestFailed'),
        description: t('alerts.qrRequestFailed'),
      });
    }
  };

  const requestPairingCode = async () => {
    if (isMockMode) {
      onAlert({
        open: true,
        title: isRTL ? 'وضع العرض التجريبي' : 'Mock Mode',
        description: isRTL
          ? 'الواتساب غير متاح في وضع العرض التجريبي. عيّن NEXT_PUBLIC_USE_MOCK=false وأعد تشغيل الخادم.'
          : 'WhatsApp is unavailable in mock mode. Set NEXT_PUBLIC_USE_MOCK=false and restart the dev server.',
      });
      return;
    }
    if (!pairingPhone) {
      onAlert({
        open: true,
        title: isRTL ? 'رقم الهاتف مطلوب' : 'Phone number required',
        description: isRTL ? 'أدخل رقم الهاتف أولاً' : 'Please enter your phone number first',
      });
      return;
    }
    try {
      const result = await apiClient.requestWhatsAppPairingCode(pairingPhone);
      setPairingCode(result.code);
    } catch (error) {
      logger.error('Pairing code request failed:', error);
      onAlert({
        open: true,
        title: t('alerts.qrRequestFailed'),
        description: isRTL ? 'فشل في توليد كود الإقران' : 'Failed to generate pairing code',
      });
    }
  };

  const copyCode = async () => {
    if (pairingCode) {
      await navigator.clipboard.writeText(pairingCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  return (
    <>
      {/* Connection card — status + primary action */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-ink font-display flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink/40"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>
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
                      <Check className="h-4 w-4 text-success" />
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

          {/* Refresh — secondary, inline */}
          <div className="flex justify-end">
            <Button
              onClick={onRefreshStatus}
              disabled={false}
              variant="ghost"
              size="sm"
              className="gap-1.5 text-ink/50 hover:text-ink"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('refreshStatus')}
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
                {hasQr && whatsappQr ? (
                  <div className="bg-canvas p-4 rounded-lg border border-ink/10">
                    <img
                      src={whatsappQr}
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
  );
}
