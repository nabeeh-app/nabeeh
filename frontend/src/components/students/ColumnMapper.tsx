'use client';

import { useTranslations } from 'next-intl';
import { ArrowRight, Info } from 'lucide-react';

const STUDENT_FIELDS = [
  { value: 'name', label: 'Name', required: true },
  { value: 'student_code', label: 'Student Code', required: true },
  { value: 'phone', label: 'Phone', required: false },
  { value: 'parent_phone', label: 'Parent Phone', required: false },
  { value: 'parent_name', label: 'Parent Name', required: false },
  { value: 'grade_level', label: 'Grade Level', required: false },
  { value: 'date_of_birth', label: 'Date of Birth', required: false },
  { value: 'gender', label: 'Gender', required: false },
  { value: 'email', label: 'Email', required: false },
  { value: 'address', label: 'Address', required: false },
  { value: 'notes', label: 'Notes', required: false },
  { value: '_skip', label: '— Skip —', required: false }
];

interface ColumnMapperProps {
  headers: string[];
  autoMapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
}

export default function ColumnMapper({ headers, autoMapping, onMappingChange }: ColumnMapperProps) {
  const t = useTranslations('import.mapper');

  const handleMappingChange = (header: string, field: string) => {
    const newMapping = { ...autoMapping };
    if (field === '_skip') {
      delete newMapping[header];
    } else {
      newMapping[header] = field;
    }
    onMappingChange(newMapping);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-[var(--color-ink)]/60">
        <Info className="h-4 w-4" />
        <span>{t('autoDetected')}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-ink)]/10">
              <th className="py-2 text-left font-medium text-[var(--color-ink)]">{t('columnHeader')}</th>
              <th className="py-2 w-8" />
              <th className="py-2 text-left font-medium text-[var(--color-ink)]">{t('mapsToField')}</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((header) => {
              const mappedField = autoMapping[header] || '_skip';
              const isRequired = STUDENT_FIELDS.find(f => f.value === mappedField)?.required;

              return (
                <tr key={header} className="border-b border-[var(--color-ink)]/5">
                  <td className="py-3 font-mono text-[var(--color-ink)]">
                    {header}
                    {isRequired && (
                      <span className="ml-1 text-xs text-[var(--color-error)]">*</span>
                    )}
                  </td>
                  <td className="py-3 text-center">
                    <ArrowRight className="h-4 w-4 mx-auto text-[var(--color-ink)]/30" />
                  </td>
                  <td className="py-3">
                    <select
                      value={mappedField}
                      onChange={(e) => handleMappingChange(header, e.target.value)}
                      className="rounded-lg border border-[var(--color-ink)]/20 bg-[var(--color-surface)] px-3 py-1.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
                    >
                      {STUDENT_FIELDS.map((field) => (
                        <option key={field.value} value={field.value}>
                          {field.label} {field.required ? '(Required)' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg bg-[var(--color-surface)] p-3 text-sm text-[var(--color-ink)]/60">
        {t('mappedCount', {
          mapped: Object.values(autoMapping).filter(v => v !== '_skip').length,
          total: headers.length
        })}
      </div>
    </div>
  );
}
