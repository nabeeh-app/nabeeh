'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle, XCircle, Edit3, ArrowLeft, ClipboardCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { ApprovalQueue } from './ApprovalQueue';
import { CommentDraft } from './CommentDraft';
import { CommentEditor } from './CommentEditor';
import { ReportSendDialog } from '../reports/ReportSendDialog';
import type { ReportDraft } from '@/types';

export function CommentApproval() {
  const t = useTranslations('reports.approval');
  const [selectedDraft, setSelectedDraft] = useState<ReportDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [error, setError] = useState('');

  const handleApprove = useCallback(async (draft: ReportDraft) => {
    try {
      const res = await apiClient.approveReportDraft(draft.id);
      if (res.success) {
        setSelectedDraft(null);
        setRefreshKey(prev => prev + 1);
      }
    } catch {
      setError(t('saveFailed'));
    }
  }, [t]);

  const handleReject = useCallback(async (draft: ReportDraft) => {
    try {
      const res = await apiClient.rejectReportDraft(draft.id);
      if (res.success) {
        setSelectedDraft(null);
        setRefreshKey(prev => prev + 1);
      }
    } catch {
      setError(t('saveFailed'));
    }
  }, [t]);

  const handleSaved = useCallback((updated: ReportDraft) => {
    setSelectedDraft(updated);
    setEditing(false);
  }, []);

  if (selectedDraft) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedDraft(null); setEditing(false); }}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {t('backToQueue')}
        </Button>

        {error && (
          <p className="text-sm text-destructive font-body">{error}</p>
        )}

        {editing ? (
          <CommentEditor
            draft={selectedDraft}
            onSaved={handleSaved}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <CommentDraft draft={selectedDraft} />
        )}

        {(selectedDraft.status === 'pending' || selectedDraft.status === 'edited') && !editing && (
          <Card>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-ink/60" />
                <span className="text-sm text-ink/60 font-body">{t('reviewPrompt')}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  <Edit3 className="h-4 w-4 mr-1" />
                  {t('edit')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleReject(selectedDraft)}>
                  <XCircle className="h-4 w-4 mr-1" />
                  {t('reject')}
                </Button>
                <Button size="sm" onClick={() => handleApprove(selectedDraft)}>
                  <CheckCircle className="h-4 w-4 mr-1" />
                  {t('approve')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedDraft.status === 'approved' && (
          <div className="flex justify-end">
            <Button onClick={() => setSendDialogOpen(true)}>
              {t('sendToParent')}
            </Button>
          </div>
        )}

        <ReportSendDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          draftId={selectedDraft.id}
          studentName={selectedDraft.student?.name}
          onSuccess={() => { setSelectedDraft(null); setRefreshKey(prev => prev + 1); }}
        />
      </div>
    );
  }

  return <ApprovalQueue onSelectDraft={setSelectedDraft} refreshKey={refreshKey} />;
}
