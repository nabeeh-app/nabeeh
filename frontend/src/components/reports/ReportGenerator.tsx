'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { ReportPreview } from './ReportPreview';
import { ReportSendDialog } from './ReportSendDialog';
import type { ReportDraft, Offering } from '@/types';

export function ReportGenerator() {
  const t = useTranslations('reports.generation');
  const tCommon = useTranslations('common');

  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selectedOffering, setSelectedOffering] = useState('');
  const [students, setStudents] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    apiClient.getOfferings().then(data => {
      if (Array.isArray(data)) setOfferings(data);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedOffering) {
      // Reset via async to avoid synchronous setState in effect
      void Promise.resolve().then(() => setStudents([]));
      return;
    }
    const offering = offerings.find(o => o.id === selectedOffering);
    if (!offering) return;

    const groups = offering.groups || [];
    const fetchPromises = groups.map(g =>
      apiClient.getStudents({ group_id: g.id, limit: 100 }).catch(() => ({ data: [] as Array<{ id: string; name: string }>, pagination: { total: 0 } }))
    );

    Promise.all(fetchPromises).then(results => {
      const allStudents = results
        .flatMap(r => (r as { data?: Array<{ id: string; name: string }> }).data || [])
        .filter((s: { id: string }, i: number, arr: Array<{ id: string }>) => arr.findIndex((x: { id: string }) => x.id === s.id) === i);
      setStudents(allStudents);
    });
  }, [selectedOffering, offerings]);

  const handleGenerate = async () => {
    if (!selectedStudent) return;
    setGenerating(true);
    setDraft(null);
    try {
      const res = await apiClient.generateReportComment(selectedStudent, selectedOffering || undefined);
      if (res.success && res.data) {
        setDraft({
          id: res.data.id,
          student_id: selectedStudent,
          group_id: selectedOffering || null,
          draft_text: res.data.draft_text,
          data_sources: null,
          status: 'pending',
          edited_text: null,
          sent_at: null,
          created_at: res.data.created_at,
          student: students.find(s => s.id === selectedStudent) ? { name: students.find(s => s.id === selectedStudent)!.name } : undefined,
        });
      }
    } catch {
      // silent
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!draft) return;
    try {
      const res = await apiClient.updateReportDraft(draft.id, { edited_text: editText, status: 'edited' });
      if (res.success) {
        setDraft(prev => prev ? { ...prev, edited_text: editText, status: 'edited' } : null);
        setEditing(false);
      }
    } catch {
      // silent
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-ink font-display">
            <Sparkles className="h-5 w-5" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-ink font-body mb-1 block">
                {t('selectOffering')}
              </label>
              <Select value={selectedOffering} onValueChange={setSelectedOffering}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectOffering')} />
                </SelectTrigger>
                <SelectContent>
                  {offerings.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.subject.name_en} — {o.grade_level.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-ink font-body mb-1 block">
                {t('selectStudent')}
              </label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={!selectedOffering}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectStudent')} />
                </SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={!selectedStudent || generating}>
              {generating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-1" />
              )}
              {generating ? t('generating') : t('generateComment')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {draft && (
        <>
          {editing ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-ink font-display">{t('editDraft')}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                    {tCommon('cancel')}
                  </Button>
                  <Button size="sm" onClick={handleSaveEdit}>
                    {tCommon('save')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  className="w-full min-h-[200px] p-3 rounded-lg border border-border bg-canvas text-sm text-ink font-body resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </CardContent>
            </Card>
          ) : (
            <ReportPreview
              draft={draft}
              onEdit={(text) => { setEditText(text); setEditing(true); }}
            />
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setDraft(null); setEditing(false); }}>
              {t('discard')}
            </Button>
            <Button onClick={() => setSendDialogOpen(true)}>
              <FileText className="h-4 w-4 mr-1" />
              {t('sendToParent')}
            </Button>
          </div>
        </>
      )}

      {draft && (
        <ReportSendDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          draftId={draft.id}
          studentName={draft.student?.name}
          onSuccess={() => { setDraft(null); setEditing(false); }}
        />
      )}
    </div>
  );
}
