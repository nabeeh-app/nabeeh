'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Unlink, MessageSquare, Loader2 } from 'lucide-react';

interface WhatsAppStatusProps {
  isLoading: boolean;
  onTestMessage: () => void;
  onLogout: () => void;
}

export default function WhatsAppStatus({
  isLoading,
  onTestMessage,
  onLogout,
}: WhatsAppStatusProps) {
  const t = useTranslations('whatsapp');

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-surface-sage flex items-center justify-center">
            <CheckCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink">{t('statusConnectedTitle')}</p>
            <p className="text-xs text-ink/50 font-body">{t('statusConnectedDescription')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={onTestMessage}
              disabled={isLoading}
              size="sm"
              variant="outline"
              className="gap-1.5"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              {t('testMessage')}
            </Button>
            <Button
              onClick={onLogout}
              disabled={isLoading}
              size="sm"
              variant="outline"
              className="gap-1.5 border-destructive/20 text-destructive hover:bg-destructive/10"
            >
              <Unlink className="h-3.5 w-3.5" />
              {t('logout')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
