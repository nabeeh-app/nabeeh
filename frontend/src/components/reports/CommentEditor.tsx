'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import type { ReportDraft } from '@/types';

interface CommentEditorProps {
  draft: ReportDraft;
  onSaved: (updatedDraft: ReportDraft) => void;
  onCancel: () => void;
}

export function CommentEditor({ draft, onSaved, onCancel }: CommentEditorProps) {
  const t = useTranslations('reports.approval');
  const [text, setText] = useState(draft.edited_text || draft.draft_text);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiClient.updateReportDraft(draft.id, { edited_text: text, status: 'edited' });
      if (res.success) {
        onSaved({ ...draft, edited_text: text, status: 'edited' });
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-ink font-display">{t('editDraft')}</CardTitle>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4 mr-1" />
            {t('cancel')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? t('saving') : t('save')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          className="w-full min-h-[200px] p-3 rounded-lg border border-border bg-canvas text-sm text-ink font-body resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder={t('editPlaceholder')}
        />
      </CardContent>
    </Card>
  );
}
