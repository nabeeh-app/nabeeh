import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import apiClient from "@/lib/client"
import logger from "@/lib/logger"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function timeAgo(dateStr: string, locale: string = 'ar', t?: (key: string, params?: Record<string, unknown>) => string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);

  if (t) {
    if (mins < 1) return t('timeAgo.justNow');
    if (mins < 60) return t('timeAgo.minutesAgo', { n: mins });
    if (hours < 24) return t('timeAgo.hoursAgo', { n: hours });
    return t('timeAgo.daysAgo', { n: days });
  }

  if (locale === 'ar') {
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} د`;
    if (hours < 24) return `منذ ${hours} س`;
    return `منذ ${days} ي`;
  }
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// Unified status badge utility
export const getStatusBadge = (status: string, locale: 'en' | 'ar' = 'ar', t?: (key: string) => string) => {
  const statusMap: Record<string, { variant: 'default' | 'destructive' | 'secondary' | 'outline', label: string, labelAr: string, color: string }> = {
    // Common statuses
    active: { variant: 'default', label: 'Active', labelAr: 'نشط', color: 'bg-surface-sage text-ink' },
    inactive: { variant: 'secondary', label: 'Inactive', labelAr: 'غير نشط', color: 'bg-surface-cool text-ink/70' },
    pending: { variant: 'outline', label: 'Pending', labelAr: 'في الانتظار', color: 'bg-surface-cool text-ink/70' },

    // WhatsApp statuses
    connected: { variant: 'default', label: 'Connected', labelAr: 'متصل', color: 'bg-success/10 text-success' },
    disconnected: { variant: 'destructive', label: 'Disconnected', labelAr: 'غير متصل', color: 'bg-destructive/10 text-destructive' },
    connecting: { variant: 'outline', label: 'Connecting', labelAr: 'جاري الاتصال', color: 'bg-surface-cool text-ink/70' },

    // Student statuses
    graduated: { variant: 'secondary', label: 'Graduated', labelAr: 'متخرج', color: 'bg-primary/10 text-primary' },

    // Attendance statuses
    present: { variant: 'default', label: 'Present', labelAr: 'حاضر', color: 'bg-surface-sage text-ink' },
    absent: { variant: 'destructive', label: 'Absent', labelAr: 'غائب', color: 'bg-destructive/10 text-destructive' },
    late: { variant: 'outline', label: 'Late', labelAr: 'متأخر', color: 'bg-surface-cool text-ink/70' },
    excused: { variant: 'secondary', label: 'Excused', labelAr: 'معذور', color: 'bg-primary/10 text-primary' },

    // Course/Class statuses
    ready: { variant: 'default', label: 'Ready', labelAr: 'جاهز', color: 'bg-success/10 text-success' },
    draft: { variant: 'outline', label: 'Draft', labelAr: 'مسودة', color: 'bg-surface-cool text-ink/70' },
    archived: { variant: 'secondary', label: 'Archived', labelAr: 'مؤرشف', color: 'bg-surface-cool text-ink/70' },

    // System statuses
    online: { variant: 'default', label: 'Online', labelAr: 'متصل', color: 'bg-success/10 text-success' },
    offline: { variant: 'destructive', label: 'Offline', labelAr: 'غير متصل', color: 'bg-destructive/10 text-destructive' },
    working: { variant: 'default', label: 'Working', labelAr: 'يعمل', color: 'bg-success/10 text-success' },
    failed: { variant: 'destructive', label: 'Failed', labelAr: 'فشل', color: 'bg-destructive/10 text-destructive' },
    starting: { variant: 'outline', label: 'Starting', labelAr: 'بدء التشغيل', color: 'bg-surface-cool text-ink/70' },
    qr_ready: { variant: 'secondary', label: 'Scan QR', labelAr: 'امسح الرمز', color: 'bg-primary/10 text-primary' }
  };

  const config = statusMap[status.toLowerCase()] || { variant: 'outline' as const, label: status, labelAr: status, color: 'bg-surface-cool text-ink/70' };

  const label = t
    ? (t(`statuses.${status.toLowerCase()}`) || config.label)
    : (locale === 'ar' ? config.labelAr : config.label);

  return {
    variant: config.variant,
    label,
    color: config.color
  };
};

// Unified WhatsApp status checker
export const checkWhatsAppStatus = async (_phone?: string) => {
  try {
    const data = await apiClient.getWhatsAppStatus();
    return {
      success: true,
      status: (data.status || 'disconnected') as 'connected' | 'disconnected' | 'qr_ready' | 'connecting' | 'error',
      message: data.status === 'connected'
        ? 'Connected'
        : data.status === 'qr_ready'
          ? 'Scan QR Code'
          : 'Disconnected',
      qr: data.qr || null,
      phone: data.phone || null,
      pairingCodeMode: data.pairingCodeMode || false
    };
  } catch (error) {
    logger.error('Check Status Error:', error);
    return {
      success: false,
      status: 'disconnected' as const,
      message: 'Error checking WhatsApp status',
      qr: null,
      phone: null,
      pairingCodeMode: false
    };
  }
};

// Unified message sending
export const sendWhatsAppMessage = async (phone: string, message: string) => {
  try {
    const response = await apiClient.api.post('/whatsapp/send-to-number', { phone, message });
    const data = response.data;
    return {
      success: data.success,
      message: data.message || (data.success ? 'Message sent successfully' : 'Failed to send message')
    };
  } catch (error) {
    logger.error('Send message error:', error);
    return {
      success: false,
      message: 'Error sending message'
    };
  }
};

// Date/time formatting utilities (locale-aware)
export function formatDate(date: Date | string, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US');
}

export function formatDateLong(date: Date | string, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

export function formatMonthYear(date: Date | string, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric', month: 'long',
  });
}

export function formatDateTime(date: Date | string, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US');
}

export function formatTime(date: Date | string, locale: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US');
}

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
