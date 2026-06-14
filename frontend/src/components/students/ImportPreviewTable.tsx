'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle, AlertTriangle, XCircle, Filter } from 'lucide-react';

interface ImportRow {
  data: Record<string, string>;
  status: 'ready' | 'warning' | 'error';
  errors: string[];
  warnings: string[];
}

interface ImportPreviewTableProps {
  rows: ImportRow[];
  stats: { total: number; ready: number; warning: number; error: number };
  onEditRow?: (index: number, field: string, value: string) => void;
}

export default function ImportPreviewTable({ rows, stats, onEditRow }: ImportPreviewTableProps) {
  const t = useTranslations('import.preview');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);

  const filteredRows = rows.filter(
    (row) => statusFilter === 'all' || row.status === statusFilter
  );

  const allFields = [...new Set(rows.flatMap((r) => Object.keys(r.data)))];

  const statusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const statusBg = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-green-50';
      case 'warning':
        return 'bg-yellow-50';
      case 'error':
        return 'bg-red-50';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm text-[var(--color-ink)]">
          <Filter className="h-4 w-4" />
          {t('filterByStatus')}:
        </div>
        {['all', 'ready', 'warning', 'error'].map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              statusFilter === filter
                ? 'bg-[var(--color-primary)] text-white'
                : 'bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface-sage)]'
            }`}
          >
            {filter === 'all' ? t('all') : t(filter)} ({filter === 'all' ? stats.total : stats[filter as keyof typeof stats]})
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--color-ink)]/10 overflow-hidden">
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--color-surface)]">
              <tr className="border-b border-[var(--color-ink)]/10">
                <th className="px-3 py-2 text-left font-medium text-[var(--color-ink)] w-10">#</th>
                <th className="px-3 py-2 text-left font-medium text-[var(--color-ink)] w-16">{t('status')}</th>
                {allFields.map((field) => (
                  <th key={field} className="px-3 py-2 text-left font-medium text-[var(--color-ink)]">
                    {field}
                  </th>
                ))}
                <th className="px-3 py-2 text-left font-medium text-[var(--color-ink)]">{t('issues')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row, idx) => {
                const originalIndex = rows.indexOf(row);
                return (
                  <tr
                    key={idx}
                    className={`border-b border-[var(--color-ink)]/5 ${statusBg(row.status)}`}
                  >
                    <td className="px-3 py-2 text-[var(--color-ink)]/50">{originalIndex + 1}</td>
                    <td className="px-3 py-2">{statusIcon(row.status)}</td>
                    {allFields.map((field) => {
                      const isEditing = editingCell?.row === originalIndex && editingCell?.field === field;
                      return (
                        <td
                          key={field}
                          className="px-3 py-2 cursor-pointer hover:bg-[var(--color-surface)]"
                          onClick={() => setEditingCell({ row: originalIndex, field })}
                        >
                          {isEditing && onEditRow ? (
                            <input
                              autoFocus
                              defaultValue={row.data[field] || ''}
                              onBlur={(e) => {
                                onEditRow(originalIndex, field, e.target.value);
                                setEditingCell(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  onEditRow(originalIndex, field, (e.target as HTMLInputElement).value);
                                  setEditingCell(null);
                                }
                              }}
                              className="w-full rounded border border-[var(--color-primary)] px-1 py-0.5 text-sm"
                            />
                          ) : (
                            <span className={row.data[field] ? '' : 'text-[var(--color-ink)]/30'}>
                              {row.data[field] || '—'}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2">
                      {row.errors.length > 0 && (
                        <div className="text-xs text-red-600">{row.errors.join('; ')}</div>
                      )}
                      {row.warnings.length > 0 && (
                        <div className="text-xs text-yellow-600">{row.warnings.join('; ')}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-4 text-sm">
        <span className="text-green-600">{t('ready')}: {stats.ready}</span>
        <span className="text-yellow-600">{t('warning')}: {stats.warning}</span>
        <span className="text-red-600">{t('error')}: {stats.error}</span>
      </div>
    </div>
  );
}
