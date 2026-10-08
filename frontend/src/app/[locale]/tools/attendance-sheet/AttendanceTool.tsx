'use client';

import { useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Printer, FileSpreadsheet, Eraser, Sparkles } from 'lucide-react';
import {
  getMonthDays,
  nextMark,
  countAbsences,
  downloadExcel,
  MARK_SYMBOL,
  type Mark,
  type SchoolDaysMode,
} from '@/lib/attendance-excel';

const SAMPLE_AR = ['أحمد محمد', 'سارة علي', 'يوسف خالد', 'مريم حسن', 'عمر مصطفى', 'فاطمة أحمد'];
const SAMPLE_EN = ['Ahmed Mohamed', 'Sara Ali', 'Youssef Khaled', 'Mariam Hassan', 'Omar Mostafa'];

export function AttendanceTool() {
  const t = useTranslations('tools.attendance');
  const locale = useLocale();
  const rtl = locale === 'ar';

  const now = new Date();
  const [monthValue, setMonthValue] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [mode, setMode] = useState<SchoolDaysMode>('no-friday');
  const [group, setGroup] = useState('');
  const [teacher, setTeacher] = useState('');
  const [rawNames, setRawNames] = useState('');
  const [marks, setMarks] = useState<Record<string, Mark>>({});

  const [year, monthIdx] = useMemo(() => {
    const [y, m] = monthValue.split('-').map(Number);
    return [y || now.getFullYear(), (m || 1) - 1];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthValue]);

  const days = useMemo(
    () => getMonthDays(year, monthIdx, mode, locale),
    [year, monthIdx, mode, locale]
  );

  const students = useMemo(
    () => rawNames.split('\n').map((s) => s.trim()).filter(Boolean),
    [rawNames]
  );

  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(year, monthIdx, 1)),
    [year, monthIdx, locale]
  );

  const toggle = (student: string, di: number) => {
    const key = `${student}::${di}`;
    setMarks((prev) => ({ ...prev, [key]: nextMark(prev[key] ?? null) }));
  };

  const cellClass = (m: Mark) =>
    m === 'present'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
      : m === 'absent'
        ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
        : m === 'late'
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
          : 'hover:bg-surface-cool';

  return (
    <div dir={rtl ? 'rtl' : 'ltr'}>
      {/* Form */}
      <section className="no-print rounded-xl border border-ink/10 bg-canvas p-5 sm:p-6 space-y-4">
        <h2 className="font-display font-bold text-lg">{t('formTitle')}</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">{t('groupLabel')}</span>
            <input
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder={t('groupPlaceholder')}
              className="w-full h-11 rounded-md border border-ink/15 bg-canvas px-3 text-sm"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">{t('teacherLabel')}</span>
            <input
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
              placeholder={t('teacherPlaceholder')}
              className="w-full h-11 rounded-md border border-ink/15 bg-canvas px-3 text-sm"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">{t('monthLabel')}</span>
            <input
              type="month"
              value={monthValue}
              onChange={(e) => e.target.value && setMonthValue(e.target.value)}
              className="w-full h-11 rounded-md border border-ink/15 bg-canvas px-3 text-sm"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">{t('schoolDaysLabel')}</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as SchoolDaysMode)}
              className="w-full h-11 rounded-md border border-ink/15 bg-canvas px-3 text-sm"
            >
              <option value="all">{t('modeAll')}</option>
              <option value="no-friday">{t('modeNoFriday')}</option>
              <option value="fri-sat-off">{t('modeFriSat')}</option>
            </select>
          </label>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('studentsLabel')}</span>
            <button
              type="button"
              onClick={() => setRawNames((rtl ? SAMPLE_AR : SAMPLE_EN).join('\n'))}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {t('sampleBtn')}
            </button>
          </div>
          <textarea
            value={rawNames}
            onChange={(e) => setRawNames(e.target.value)}
            placeholder={t('studentsPlaceholder')}
            rows={5}
            className="w-full rounded-md border border-ink/15 bg-canvas px-3 py-2 text-sm leading-6"
          />
          <p className="text-xs text-ink/50">
            {t('studentsHint', { count: students.length, days: days.length })}
          </p>
        </div>
      </section>

      {/* Toolbar */}
      {students.length > 0 && (
        <div className="no-print flex flex-wrap items-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md bg-primary text-white text-sm font-medium"
          >
            <Printer className="h-4 w-4" />
            {t('printBtn')}
          </button>
          <button
            type="button"
            onClick={() =>
              downloadExcel({
                students,
                days,
                marks,
                group: group || '—',
                teacher: teacher || '—',
                monthLabel,
                s: {
                  serial: '#',
                  student: t('studentsLabel').split('(')[0].trim(),
                  totalAbsences: t('totalAbsences'),
                  present: t('present'),
                  absent: t('absent'),
                  late: t('late'),
                  group: t('groupLabel').split('(')[0].trim(),
                  teacher: t('teacherLabel').split('(')[0].trim(),
                  month: t('monthLabel'),
                  sheetTitle: `${group || '—'} - ${monthLabel}`,
                },
                rtl,
              })
            }
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-ink/15 text-sm font-medium hover:bg-surface-cool"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {t('excelBtn')}
          </button>
          <button
            type="button"
            onClick={() => setMarks({})}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-md border border-ink/15 text-sm text-ink/60 hover:bg-surface-cool"
          >
            <Eraser className="h-4 w-4" />
            {t('clearBtn')}
          </button>
          <span className="text-xs text-ink/50 ms-auto">{t('legend')}</span>
        </div>
      )}

      {/* Sheet */}
      {students.length === 0 ? (
        <p className="no-print mt-6 rounded-xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/60">
          {t('emptyState')}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-ink/10">
          <div className="print:block hidden p-4 border-b border-ink/10">
            <h2 className="font-display font-bold text-xl">
              {group || '—'} — {monthLabel}
            </h2>
            {teacher && <p className="text-sm text-ink/60">{teacher}</p>}
          </div>
          <table className="w-full border-collapse text-sm min-w-max">
            <thead>
              <tr className="bg-surface-cool">
                <th className="sticky start-0 bg-surface-cool border p-2 text-start min-w-40"># / {t('studentsLabel').split('(')[0].trim()}</th>
                {days.map((d, i) => (
                  <th key={i} className="border p-1.5 min-w-9 text-center">
                    <div className="font-bold">{d.date}</div>
                    <div className="text-[10px] font-normal text-ink/50">{d.weekday}</div>
                  </th>
                ))}
                <th className="border p-2 min-w-16">{t('totalAbsences')}</th>
              </tr>
            </thead>
            <tbody>
              {students.map((name, si) => {
                const abs = countAbsences(marks, name);
                const risk = abs >= 5;
                return (
                  <tr key={si} className={risk ? 'bg-red-50/60 dark:bg-red-950/20' : undefined}>
                    <td className="sticky start-0 bg-canvas border p-2 font-medium whitespace-nowrap">
                      {si + 1}. {name}
                      {risk && (
                        <span className="ms-2 text-[10px] font-bold text-red-700 dark:text-red-300">
                          {t('atRisk')}
                        </span>
                      )}
                    </td>
                    {days.map((_, di) => {
                      const m = marks[`${name}::${di}`] ?? null;
                      return (
                        <td key={di} className="border p-0.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggle(name, di)}
                            title={m ? t(m) : t('unmarked')}
                            className={`no-print w-8 h-8 rounded font-bold ${cellClass(m)}`}
                          >
                            {m ? MARK_SYMBOL[m] : ''}
                          </button>
                          <span className="hidden print:inline font-bold">
                            {m ? MARK_SYMBOL[m] : ''}
                          </span>
                        </td>
                      );
                    })}
                    <td className="border p-2 text-center font-bold">{abs}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
