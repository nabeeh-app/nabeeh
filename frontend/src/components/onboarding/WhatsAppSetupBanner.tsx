'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Smartphone, X } from 'lucide-react';

interface WhatsAppSetupBannerProps {
  isConnected?: boolean;
  onConnect?: () => void;
}

export function WhatsAppSetupBanner({
  isConnected = false,
  onConnect,
}: WhatsAppSetupBannerProps) {
  const t = useTranslations('whatsappBanner');
  const [dismissed, setDismissed] = useState(false);

  if (isConnected || dismissed) return null;

  return (
    <div className="border bg-primary/10 border-primary/20 px-4 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Smartphone className="h-5 w-5 text-primary shrink-0" />
        <p className="text-sm font-medium">{t('message')}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={onConnect}>
          {t('connectNow')}
        </Button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('dismiss')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
