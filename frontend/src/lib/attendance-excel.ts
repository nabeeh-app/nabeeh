import * as XLSX from 'xlsx';

export type Mark = 'present' | 'absent' | 'late' | null;
export type SchoolDaysMode = 'all' | 'no-friday' | 'fri-sat-off';

export interface SheetDay {
  date: number;
  weekday: string;
}

export function getMonthDays(
  year: number,
  month: number,
  mode: SchoolDaysMode,
  locale: string
): SheetDay[] {
  const days: SheetDay[] = [];
  const count = new Date(year, month + 1, 0).getDate();
  const fmt = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en', { weekday: 'short' });
  for (let d = 1; d <= count; d++) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (mode === 'no-friday' && dow === 5) continue;
    if (mode === 'fri-sat-off' && (dow === 5 || dow === 6)) continue;
    days.push({ date: d, weekday: fmt.format(date) });
  }
  return days;
}

export const MARK_SYMBOL: Record<Exclude<Mark, null>, string> = {
  present: '✓',
  absent: '✗',
  late: 'L',
};

export function nextMark(m: Mark): Mark {
  if (m === null) return 'present';
  if (m === 'present') return 'absent';
  if (m === 'absent') return 'late';
  return null;
}

export function countAbsences(marks: Record<string, Mark>, student: string): number {
  return Object.entries(marks).filter(
    ([key, m]) => m === 'absent' && key.startsWith(`${student}::`)
  ).length;
}

export interface ExcelStrings {
  serial: string;
  student: string;
  totalAbsences: string;
  present: string;
  absent: string;
  late: string;
  group: string;
  teacher: string;
  month: string;
  sheetTitle: string;
}

export function downloadExcel(opts: {
  students: string[];
  days: SheetDay[];
  marks: Record<string, Mark>;
  group: string;
  teacher: string;
  monthLabel: string;
  s: ExcelStrings;
  rtl: boolean;
}) {
  const header = [opts.s.serial, opts.s.student, ...opts.days.map((d) => `${d.date}`), opts.s.totalAbsences];
  const rows: (string | number)[][] = [header];
  opts.students.forEach((name, i) => {
    const cells = opts.days.map((_, di) => {
      const m = opts.marks[`${name}::${di}`];
      if (m === 'present') return opts.s.present;
      if (m === 'absent') return opts.s.absent;
      if (m === 'late') return opts.s.late;
      return '';
    });
    rows.push([i + 1, name, ...cells, countAbsences(opts.marks, name)]);
  });

  const ws = XLSX.utils.aoa_to_sheet([
    [opts.s.sheetTitle],
    [`${opts.s.group}: ${opts.group}`, `${opts.s.teacher}: ${opts.teacher}`, `${opts.s.month}: ${opts.monthLabel}`],
    [],
    ...rows,
  ]);
  if (opts.rtl) {
    (ws as { '!views'?: unknown[] })['!views'] = [{ rightToLeft: 1 }];
  }
  ws['!cols'] = [{ wch: 6 }, { wch: 24 }, ...opts.days.map(() => ({ wch: 5 })), { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  XLSX.writeFile(wb, `attendance-${Date.now()}.xlsx`);
}
