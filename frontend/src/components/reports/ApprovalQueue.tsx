'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { ClipboardCheck, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import type { ReportDraft } from '@/types';

const STATUS_VARIANT = {
  pending: 'warning' as const,
  approved: 'success' as const,
  edited: 'default' as const,
  rejected: 'destructive' as const,
  sent: 'secondary' as const,
};

interface ApprovalQueueProps {
  onSelectDraft: (draft: ReportDraft) => void;
  refreshKey?: number;
}

export function ApprovalQueue({ onSelectDraft, refreshKey }: ApprovalQueueProps) {
  const t = useTranslations('reports.approval');
  const [drafts, setDrafts] = useState<ReportDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await apiClient.getReportDrafts({ status: 'pending', limit: 50 });
      if (res.success && Array.isArray(res.data)) {
        setDrafts(res.data as ReportDraft[]);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchDrafts();
  }, [fetchDrafts, refreshKey]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin h-8 w-8 border-b-2 border-ink mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-ink font-display">
          <ClipboardCheck className="h-5 w-5" />
          {t('pendingApprovals')}
          {drafts.length > 0 && (
            <Badge variant="warning" className="ml-1">{drafts.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {drafts.length === 0 ? (
          <div className="text-center py-8 text-ink/60 font-body">
            <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{t('noPendingDrafts')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {drafts.map(draft => (
              <button
                key={draft.id}
                onClick={() => onSelectDraft(draft)}
                className="w-full text-left flex items-center justify-between p-3 rounded-lg border border-border hover:bg-surface-sage/20 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink text-sm font-body">
                      {draft.student?.name || t('unknownStudent')}
                    </span>
                    <Badge variant="warning">{t('pending')}</Badge>
                  </div>
                  <p className="text-sm text-ink/60 font-body mt-0.5 line-clamp-1">
                    {draft.draft_text}
                  </p>
                </div>
                <Edit3 className="h-4 w-4 text-ink/40 shrink-0 ml-2" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
