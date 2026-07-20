'use client';

import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

interface FileUploadZoneProps {
  onFileSelected: (file: File) => void;
  onPasteData?: (text: string) => void;
  accept?: string;
  isLoading?: boolean;
}

export default function FileUploadZone({
  onFileSelected,
  onPasteData,
  accept = '.csv,.xls,.xlsx,.tsv',
  isLoading = false
}: FileUploadZoneProps) {
  const t = useTranslations('import.upload');
  const [isDragOver, setIsDragOver] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelected(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
  };

  const handlePaste = () => {
    if (pasteText.trim() && onPasteData) {
      onPasteData(pasteText);
      setPasteText('');
      setShowPaste(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8
          cursor-pointer transition-all duration-200
          ${isDragOver
            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
            : 'border-[var(--color-ink)]/20 hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface)]'
          }
          ${isLoading ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <div className="rounded-full bg-[var(--color-surface-cool)] p-4 mb-4">
          <Upload className="h-8 w-8 text-[var(--color-primary)]" />
        </div>
        <p className="text-lg font-medium text-[var(--color-ink)] mb-1">
          {isDragOver ? t('dropHere') : t('title')}
        </p>
        <p className="text-sm text-[var(--color-ink)]/60 mb-3">{t('description')}</p>
        <p className="text-xs text-[var(--color-ink)]/40">{t('supportedFormats')}</p>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {onPasteData && (
        <div className="text-center">
          <Button variant="link" size="sm" onClick={() => setShowPaste(!showPaste)}>
            <ClipboardPaste className="h-4 w-4" />
            {t('pasteTitle')}
          </Button>
        </div>
      )}

      {showPaste && (
        <div className="space-y-3">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={t('pastePlaceholder')}
            rows={6}
            className="w-full rounded-lg border border-[var(--color-ink)]/20 bg-[var(--color-surface)] p-3 text-sm font-mono focus:border-[var(--color-primary)] focus:outline-none"
          />
          <Button onClick={handlePaste} disabled={!pasteText.trim()}>
            <FileSpreadsheet className="h-4 w-4" />
            {t('parsePaste')}
          </Button>
        </div>
      )}
    </div>
  );
}
