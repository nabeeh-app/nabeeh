'use client';

import { useTranslations } from 'next-intl';
import { FileText, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataSourcesBadges } from './DataSourcesBadges';
import type { ReportDraft } from '@/types';

const STATUS_CONFIG = {
  pending: { label: 'pending', variant: 'warning' as const },
  approved: { label: 'approved', variant: 'success' as const },
  edited: { label: 'edited', variant: 'default' as const },
  rejected: { label: 'rejected', variant: 'destructive' as const },
  sent: { label: 'sent', variant: 'secondary' as const },
};

interface ReportPreviewProps {
  draft: ReportDraft;
  onEdit?: (text: string) => void;
  compact?: boolean;
}

export function ReportPreview({ draft, onEdit, compact }: ReportPreviewProps) {
  const t = useTranslations('reports.generation');
  const statusConfig = STATUS_CONFIG[draft.status] || STATUS_CONFIG.pending;

  const displayText = draft.edited_text || draft.draft_text;
  const sources = draft.data_sources as Record<string, unknown> | null;

  if (compact) {
    return (
      <div className="p-3 rounded-lg border border-border bg-canvas">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={statusConfig.variant}>{t(statusConfig.label)}</Badge>
          {draft.student?.name && (
            <span className="text-sm text-ink/60 font-body">{draft.student.name}</span>
          )}
        </div>
        <p className="text-sm text-ink/80 font-body line-clamp-3">{displayText}</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-ink font-display">
          <FileText className="h-5 w-5" />
          {t('reportPreview')}
        </CardTitle>
        <Badge variant={statusConfig.variant}>{t(statusConfig.label)}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg border border-border bg-surface-sage/10 min-h-[120px]">
          <p className="text-sm text-ink font-body whitespace-pre-wrap">{displayText}</p>
        </div>

        {sources && <DataSourcesBadges sources={sources} />}

        {onEdit && draft.status === 'pending' && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => onEdit(displayText)}>
              <Edit3 className="h-4 w-4 mr-1" />
              {t('editDraft')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
