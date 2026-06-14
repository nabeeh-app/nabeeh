import { useState, useEffect, useCallback } from 'react';
import { checkWhatsAppStatus } from '@/lib/utils';

export interface WhatsAppStatus {
  status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'qr_ready';
  message: string;
  sessionExists: boolean;
  isLoading: boolean;
  qr?: string | null;
  phone?: string | null;
}

export const useWhatsAppStatus = (phone?: string, autoCheck = true) => {
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>({
    status: 'disconnected',
    message: 'Checking WhatsApp connection...',
    sessionExists: false,
    isLoading: false,
    qr: null,
    phone: null
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
        qr: result.qr,
        phone: result.phone
      });
    } catch {
      setWhatsappStatus({
        status: 'error',
        message: 'Error checking WhatsApp status',
        sessionExists: false,
        isLoading: false,
        qr: null,
        phone: null
      });
    }
  }, [phone]);

  useEffect(() => {
    if (!autoCheck) return;

    void (async () => {
      await checkStatus();
    })();

    // Don't poll if already connected
    if (whatsappStatus.status === 'connected') {
      return;
    }

    // Adaptive polling: faster when QR is ready (3s), slower otherwise (30s)
    const pollInterval = whatsappStatus.status === 'qr_ready' ? 3000 : 30000;

    const interval = setInterval(async () => {
      const result = await checkWhatsAppStatus(phone);
      if (result.status === 'connected') {
        clearInterval(interval);
        setWhatsappStatus({
          status: result.status,
          message: result.message,
          sessionExists: true,
          isLoading: false,
          qr: result.qr,
          phone: result.phone
        });
      } else {
        setWhatsappStatus(prev => ({
          ...prev,
          status: result.status,
          message: result.message,
          sessionExists: result.status === 'connected',
          isLoading: false,
          qr: result.qr,
          phone: result.phone
        }));
      }
    }, pollInterval);
    
    return () => clearInterval(interval);
  }, [checkStatus, whatsappStatus.status, autoCheck, phone]);

  return {
    whatsappStatus,
    checkStatus,
    refreshStatus: checkStatus
  };
};
