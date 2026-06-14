import { AlertTriangle, AlertCircle, Info } from 'lucide-react';

export const SEVERITY_CONFIG = {
  info: {
    icon: Info,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    variant: 'secondary' as const,
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    variant: 'warning' as const,
  },
  critical: {
    icon: AlertCircle,
    color: 'text-destructive',
    bg: 'bg-destructive/10',
    variant: 'destructive' as const,
  },
} as const;
