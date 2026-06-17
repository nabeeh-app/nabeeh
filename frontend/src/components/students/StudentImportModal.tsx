'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X, ArrowRight, Check, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import FileUploadZone from './FileUploadZone';
import ColumnMapper from './ColumnMapper';
import ImportPreviewTable from './ImportPreviewTable';
import apiClient from '@/lib/api';
import { useOfferings } from '@/hooks/useOfferings';

interface ImportRow {
  data: Record<string, string>;
  status: 'ready' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
}

interface StudentImportModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'complete';

export default function StudentImportModal({ open, onClose, onComplete }: StudentImportModalProps) {
  const t = useTranslations('import');
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [autoMapping, setAutoMapping] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [stats, setStats] = useState({ total: 0, ready: 0, warning: 0, error: 0 });
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: offerings } = useOfferings();

  const allGroups = offerings?.flatMap((o) =>
    o.groups?.map((g) => ({ ...g, offeringSubject: o.subject?.name_en || o.subject?.name_ar })) || []
  ) || [];

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setHeaders([]);
    setAutoMapping({});
    setRows([]);
    setStats({ total: 0, ready: 0, warning: 0, error: 0 });
    setSelectedGroupId('');
    setImportResult(null);
    setError(null);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.previewImport(selectedFile);
      setHeaders(result.headers);
      setAutoMapping(result.autoMapping);
      setStep('mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePasteData = useCallback(async (text: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.parsePastedData(text);
      setHeaders(result.headers);
      setAutoMapping(result.autoMapping);
      setStep('mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse pasted data');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleValidate = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.validateImport(file, autoMapping);
      const validatedRows = result.rows.map((r) => ({
        ...r,
        status: r.status as 'ready' | 'warning' | 'error'
      }));
      setRows(validatedRows);
      setStats(result.stats);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  }, [file, autoMapping]);

  const handleImport = useCallback(async () => {
    if (!selectedGroupId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.executeImport({
        fieldMapping: autoMapping,
        rows: rows.filter((r) => r.status !== 'error'),
        groupId: selectedGroupId,
        skipErrors: true
      });
      setImportResult(result);
      setStep('complete');
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }, [autoMapping, rows, selectedGroupId, onComplete]);

  const handleEditRow = useCallback((index: number, field: string, value: string) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        data: { ...updated[index].data, [field]: value }
      };
      return updated;
    });
  }, []);

  const steps: { key: Step; label: string }[] = [
    { key: 'upload', label: t('upload.title') },
    { key: 'mapping', label: t('mapper.title') },
    { key: 'preview', label: t('preview.title') },
    { key: 'complete', label: t('complete.title') }
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            {t('title')}
            <button onClick={handleClose} className="rounded-lg p-1 hover:bg-[var(--color-surface)]">
              <X className="h-5 w-5" />
            </button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={s.key} className="flex items-center">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                  i < currentStepIndex
                    ? 'bg-[var(--color-primary)] text-white'
                    : i === currentStepIndex
                      ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] ring-2 ring-[var(--color-primary)]'
                      : 'bg-[var(--color-surface)] text-[var(--color-ink)]/40'
                }`}
              >
                {i < currentStepIndex ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="mx-1 h-4 w-4 text-[var(--color-ink)]/20" />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-error/10 p-3 text-sm text-error">{error}</div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
          </div>
        )}

        {!loading && step === 'upload' && (
          <FileUploadZone onFileSelected={handleFileSelected} onPasteData={handlePasteData} />
        )}

        {!loading && step === 'mapping' && (
          <div className="space-y-4">
            <ColumnMapper headers={headers} autoMapping={autoMapping} onMappingChange={setAutoMapping} />
            <Button onClick={handleValidate} className="w-full">
              {t('mapper.continue')}
            </Button>
          </div>
        )}

        {!loading && step === 'preview' && (
          <div className="space-y-4">
            <ImportPreviewTable rows={rows} stats={stats} onEditRow={handleEditRow} />

            <div className="space-y-2">
              <label className="text-sm font-medium text-[var(--color-ink)]">{t('preview.targetGroup')}</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full rounded-lg border border-[var(--color-ink)]/20 bg-[var(--color-surface)] p-2.5 text-sm"
              >
                <option value="">{t('preview.selectGroup')}</option>
                {allGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.offeringSubject})
                  </option>
                ))}
              </select>
            </div>

            <Button onClick={handleImport} disabled={!selectedGroupId || stats.ready === 0} className="w-full">
              {t('preview.importButton', { count: stats.ready })}
            </Button>
          </div>
        )}

        {!loading && step === 'complete' && importResult && (
          <div className="text-center py-8 space-y-4">
            <div className="rounded-full bg-success/10 p-4 mx-auto w-fit">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-ink)]">{t('complete.title')}</h3>
            <p className="text-sm text-[var(--color-ink)]/60">
              {t('complete.message', { imported: importResult.imported, skipped: importResult.skipped })}
            </p>
            <Button onClick={handleClose}>{t('complete.done')}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
