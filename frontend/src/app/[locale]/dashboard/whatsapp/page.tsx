'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';
import { sendWhatsAppMessage } from '@/lib/utils';
import { apiClient } from '@/lib/client';
import logger from '@/lib/logger';
import { AlertCircle } from 'lucide-react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import WhatsAppStatus from '@/components/dashboard/whatsapp/WhatsAppStatus';
import WhatsAppPairing from '@/components/dashboard/whatsapp/WhatsAppPairing';

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

export default function WhatsAppDashboardPage() {
  const t = useTranslations('whatsapp');
  const tc = useTranslations('common');
  const tSettings = useTranslations('settings');
  const { whatsappStatus, refreshStatus } = useWhatsAppStatus();
  const [isLoading, setIsLoading] = useState(false);

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
            <p className="font-medium text-ink">{tSettings('mockModeTitle')}</p>
            <p className="mt-1">{tSettings('mockModeDescription')}</p>
          </div>
        </div>
      )}

      {/* Connected state — compact card with actions */}
      {isConnected && (
        <WhatsAppStatus
          isLoading={isLoading}
          onTestMessage={testMessage}
          onLogout={handleLogout}
        />
      )}

      {/* Disconnected / transitioning / error — main connection flow */}
      {!isConnected && (
        <WhatsAppPairing
          isDisconnected={isDisconnected}
          hasQr={hasQr}
          isPreparing={isPreparing}
          isTransitioning={isTransitioning}
          isPairing={false}
          whatsappQr={whatsappStatus.qr ?? null}
          onRefreshStatus={refreshStatus}
          onAlert={(alert) => setAlertDialog({ ...alert, onConfirm: undefined })}
        />
      )}

      <ConfirmDialog
        open={alertDialog.open}
        onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, open }))}
        title={alertDialog.title}
        description={alertDialog.description}
        onConfirm={alertDialog.onConfirm ? () => alertDialog.onConfirm!() : () => setAlertDialog(prev => ({ ...prev, open: false }))}
        variant={alertDialog.variant}
        cancelLabel={tc('cancel')}
        confirmLabel={tc('confirm')}
      />
    </div>
  );
}
