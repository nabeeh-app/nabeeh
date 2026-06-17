'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiClient } from '@/lib/api';

interface ReportSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftId: string;
  studentName?: string;
  onSuccess?: () => void;
}

export function ReportSendDialog({ open, onOpenChange, draftId, studentName, onSuccess }: ReportSendDialogProps) {
  const t = useTranslations('reports.generation');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await apiClient.approveReportDraft(draftId);
      if (res.success) {
        setSent(true);
        setTimeout(() => {
          setSent(false);
          onOpenChange(false);
          onSuccess?.();
        }, 1500);
      }
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {sent ? (
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 mx-auto text-success mb-3" />
            <p className="text-lg font-semibold text-ink font-display">{t('sentSuccess')}</p>
            <p className="text-sm text-ink/60 font-body mt-1">
              {t('sentToParent', { name: studentName || '' })}
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                {t('confirmSend')}
              </DialogTitle>
              <DialogDescription>{t('sendDescription')}</DialogDescription>
            </DialogHeader>

            <p className="text-sm text-ink/70 font-body">
              {t('sendConfirmMessage', { name: studentName || t('thisStudent') })}
            </p>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleSend} disabled={sending}>
                <Send className="h-4 w-4 mr-1" />
                {sending ? t('sending') : t('sendToWhatsApp')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
