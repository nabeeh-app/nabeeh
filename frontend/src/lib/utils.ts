import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import apiClient from "@/lib/api"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Unified status badge utility
export const getStatusBadge = (status: string, locale: 'en' | 'ar' = 'en') => {
  const statusMap: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'outline', label: string, labelAr: string }> = {
    // Common statuses
    active: { variant: 'default', label: 'Active', labelAr: 'نشط' },
    inactive: { variant: 'secondary', label: 'Inactive', labelAr: 'غير نشط' },
    pending: { variant: 'outline', label: 'Pending', labelAr: 'في الانتظار' },

    // WhatsApp statuses
    connected: { variant: 'default', label: 'Connected', labelAr: 'متصل' },
    disconnected: { variant: 'destructive', label: 'Disconnected', labelAr: 'غير متصل' },
    connecting: { variant: 'outline', label: 'Connecting', labelAr: 'جاري الاتصال' },

    // Student statuses
    graduated: { variant: 'secondary', label: 'Graduated', labelAr: 'متخرج' },

    // Attendance statuses
    present: { variant: 'default', label: 'Present', labelAr: 'حاضر' },
    absent: { variant: 'destructive', label: 'Absent', labelAr: 'غائب' },
    late: { variant: 'outline', label: 'Late', labelAr: 'متأخر' },
    excused: { variant: 'secondary', label: 'Excused', labelAr: 'معذور' },

    // Course/Class statuses
    ready: { variant: 'default', label: 'Ready', labelAr: 'جاهز' },
    draft: { variant: 'outline', label: 'Draft', labelAr: 'مسودة' },
    archived: { variant: 'secondary', label: 'Archived', labelAr: 'مؤرشف' },

    // System statuses
    online: { variant: 'default', label: 'Online', labelAr: 'متصل' },
    offline: { variant: 'destructive', label: 'Offline', labelAr: 'غير متصل' },
    working: { variant: 'default', label: 'Working', labelAr: 'يعمل' },
    failed: { variant: 'destructive', label: 'Failed', labelAr: 'فشل' },
    starting: { variant: 'outline', label: 'Starting', labelAr: 'بدء التشغيل' },
    qr_ready: { variant: 'secondary', label: 'Scan QR', labelAr: 'امسح الرمز' }
  };

  const config = statusMap[status.toLowerCase()] || { variant: 'outline' as const, label: status, labelAr: status };

  return {
    variant: config.variant,
    label: locale === 'ar' ? config.labelAr : config.label
  };
};

// Unified WhatsApp status checker
export const checkWhatsAppStatus = async (phone?: string) => {
  try {
    const response = await apiClient.api.get('/whatsapp/status', {
      params: phone ? { phone } : undefined
    });

    const data = response.data;
    return {
      success: data.success,
      status: data.status,
      message: data.message || (data.status === 'connected'
        ? 'Connected'
        : data.status === 'qr_ready'
          ? 'Scan QR Code'
          : 'Disconnected'),
      qr: data.qr || null
    };
  } catch (error) {
    console.error('Check Status Error:', error);
    return {
      success: false,
      status: 'disconnected' as const,
      message: 'Error checking WhatsApp status',
      qr: null
    };
  }
};

// Unified message sending
export const sendWhatsAppMessage = async (phone: string, message: string) => {
  try {
    const response = await apiClient.api.post('/whatsapp/send-test', { phone, message });
    const data = response.data;
    return {
      success: data.success,
      message: data.message || (data.success ? 'Message sent successfully' : 'Failed to send message')
    };
  } catch (error) {
    console.error('Send message error:', error);
    return {
      success: false,
      message: 'Error sending message'
    };
  }
};

// Phone number formatting utility
export const formatPhoneNumber = (phone: string): string => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // Handle Egyptian phone numbers
  if (cleaned.startsWith('20')) {
    // Already has country code
    return `+${cleaned}`;
  } else if (cleaned.startsWith('0')) {
    // Remove leading 0 and add Egypt country code
    return `+20${cleaned.substring(1)}`;
  } else if (cleaned.length === 10) {
    // Assume it's Egyptian number without country code or leading 0
    return `+20${cleaned}`;
  }

  // For other formats, just add + if not present
  return phone.startsWith('+') ? phone : `+${cleaned}`;
};

// Email validation utility
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone number validation utility
export const validatePhoneNumber = (phone: string): boolean => {
  const normalized = phone.replace(/\s/g, '');
  return /^(\+20|0)?1[0-2,5]\d{8}$/.test(normalized);
};
