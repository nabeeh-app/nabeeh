import { useQuery } from '@tanstack/react-query';
import { checkWhatsAppStatus } from '@/lib/utils';

export interface WhatsAppStatus {
  status: 'connected' | 'disconnected' | 'connecting' | 'error' | 'qr_ready';
  message: string;
  sessionExists: boolean;
  isLoading: boolean;
  qr?: string | null;
  phone?: string | null;
  pairingCodeMode?: boolean;
}

export const useWhatsAppStatus = (phone?: string, autoCheck = true, t?: (key: string, params?: Record<string, string | number | Date>) => string) => {
  const { data, refetch } = useQuery({
    queryKey: ['whatsapp-status', phone],
    queryFn: () => checkWhatsAppStatus(phone, t),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'connected') return false;
      if (status === 'qr_ready' || query.state.data?.pairingCodeMode) return 3000;
      return 30000;
    },
    enabled: autoCheck,
    staleTime: 5000,
  });

  const whatsappStatus: WhatsAppStatus = data
    ? {
        status: data.status,
        message: data.message,
        sessionExists: data.status === 'connected',
        isLoading: false,
        qr: data.qr,
        phone: data.phone,
        pairingCodeMode: data.pairingCodeMode,
      }
    : {
        status: 'disconnected',
        message: 'Checking WhatsApp connection...',
        sessionExists: false,
        isLoading: true,
        qr: null,
        phone: null,
      };

  return {
    whatsappStatus,
    checkStatus: refetch,
    refreshStatus: refetch,
  };
};
