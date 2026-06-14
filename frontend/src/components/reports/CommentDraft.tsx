'use client';

import { useTranslations } from 'next-intl';
import { FileText, Clock, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReportDraft } from '@/types';

interface CommentDraftProps {
  draft: ReportDraft;
}

export function CommentDraft({ draft }: CommentDraftProps) {
  const t = useTranslations('reports.approval');

  const displayText = draft.edited_text || draft.draft_text;
  const sources = draft.data_sources as Record<string, unknown> | null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-ink font-display">
          <FileText className="h-5 w-5" />
          {t('aiDraft')}
        </CardTitle>
        <div className="flex items-center gap-2">
          {draft.student?.name && (
            <Badge variant="outline" className="text-xs">
              <User className="h-3 w-3 mr-1" />
              {draft.student.name}
            </Badge>
          )}
          <Badge variant="secondary" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {new Date(draft.created_at).toLocaleDateString()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg border border-border bg-surface-sage/10 min-h-[100px]">
          <p className="text-sm text-ink font-body whitespace-pre-wrap">{displayText}</p>
        </div>

        {sources && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-ink/60 uppercase tracking-wide font-body">
              {t('dataSource')}
            </h4>
            <div className="flex flex-wrap gap-2">
              {sources.grades != null && (
                <Badge variant="outline" className="text-xs">{t('gradesData')}</Badge>
              )}
              {sources.attendance != null && (
                <Badge variant="outline" className="text-xs">{t('attendanceData')}</Badge>
              )}
              {sources.trends != null && (
                <Badge variant="outline" className="text-xs">{t('trendsData')}</Badge>
              )}
            </div>
          </div>
        )}

        {draft.edited_text && (
          <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
            <h4 className="text-xs font-semibold text-primary mb-1 font-body">{t('editedVersion')}</h4>
            <p className="text-sm text-ink font-body whitespace-pre-wrap">{draft.edited_text}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
