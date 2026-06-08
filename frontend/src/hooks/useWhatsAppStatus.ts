import { useState, useEffect, useCallback } from 'react';
import { checkWhatsAppStatus } from '@/lib/utils';

export interface WhatsAppStatus {
  status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'qr_ready';
  message: string;
  sessionExists: boolean;
  isLoading: boolean;
  qr?: string | null;
}

export const useWhatsAppStatus = (phone?: string, autoCheck = true) => {
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>({
    status: 'disconnected',
    message: 'Checking WhatsApp connection...',
    sessionExists: false,
    isLoading: false,
    qr: null
  });

  const checkStatus = useCallback(async () => {
    // if (!phone && autoCheck) return; // Removed to allow status check without phone

    setWhatsappStatus(prev => ({ ...prev, isLoading: true }));

    try {
      const result = await checkWhatsAppStatus(phone);
      setWhatsappStatus({
        status: result.status,
        message: result.message,
        sessionExists: result.status === 'connected',
        isLoading: false,
        qr: result.qr
      });
    } catch (error) {
      setWhatsappStatus({
        status: 'error',
        message: 'Error checking WhatsApp status',
        sessionExists: false,
        isLoading: false,
        qr: null
      });
    }
  }, [phone, autoCheck]);

  useEffect(() => {
    if (!autoCheck) return;

    checkStatus();

    // Only keep polling while we are not connected
    if (whatsappStatus.status === 'connected') {
      return;
    }

    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus, autoCheck, whatsappStatus.status]);

  return {
    whatsappStatus,
    checkStatus,
    refreshStatus: checkStatus
  };
};
