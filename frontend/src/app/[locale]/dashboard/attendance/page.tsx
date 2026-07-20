'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Users,
  Download,
  Upload,
  AlertCircle,
  CalendarDays,
  FileText,
  BarChart3
} from 'lucide-react';
import { BulkAttendanceRequest, Student, Attendance } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ViewModeTabs } from '@/components/ui/ViewModeTabs';
import { useOfferings } from '@/hooks/useOfferings';
import { useStudents } from '@/hooks/useStudents';
import { useAttendanceRecords, useAttendanceSummary, useCreateAttendance } from '@/hooks/useAttendance';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import AttendanceCalendar from '@/components/dashboard/attendance/AttendanceCalendar';
import AttendanceBulkEntry from '@/components/dashboard/attendance/AttendanceBulkEntry';
import AttendanceList from '@/components/dashboard/attendance/AttendanceList';
import AttendanceStatsModal from '@/components/dashboard/attendance/AttendanceStatsModal';
import { getStatusBadge } from '@/lib/utils';

interface DailyAttendance {
  date: string;
  students: {
    student_id: string;
    name: string;
    status: 'present' | 'absent' | 'late' | 'excused' | null;
    notes?: string;
  }[];
}

export default function AttendancePage() {
  const t = useTranslations('attendance');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const locale = useLocale();
  const tRoot = useTranslations();
  const statusBadge = (status: string) => getStatusBadge(status, locale as 'en' | 'ar', tRoot);
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'bulk'>('calendar');
  const [isStatsModalOpen, setStatsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attendanceEdits, setAttendanceEdits] = useState<Map<string, 'present' | 'absent' | 'late' | 'excused'>>(new Map());

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [studentFilter, setStudentFilter] = useState<string>('');
  const [dateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  const [alertDialog, setAlertDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
    variant?: 'default' | 'destructive';
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  const { data: offerings = [], isLoading: offeringsLoading } = useOfferings();

  const groups = offerings.flatMap(o => o.groups ?? []);

  useEffect(() => {
    if (groups.length === 0 && !offeringsLoading) {
      router.replace(`/${locale}/dashboard/classes?setup=required`);
    }
  }, [groups, offeringsLoading, locale, router]);

  const effectiveSelectedGroupId = selectedGroupId || groups[0]?.id || '';

  const studentsParams = useMemo(() => effectiveSelectedGroupId ? {
    limit: 100,
    status: 'active',
    group_id: effectiveSelectedGroupId,
  } : undefined, [effectiveSelectedGroupId]);

  const { data: studentsResponse } = useStudents(studentsParams);
  const students: Student[] = useMemo(() => studentsResponse?.data ?? [], [studentsResponse]);

  const attendanceParams = useMemo(() => effectiveSelectedGroupId ? {
    limit: 100,
    start_date: dateRange.from,
    end_date: dateRange.to,
    group_id: effectiveSelectedGroupId,
  } : undefined, [effectiveSelectedGroupId, dateRange.from, dateRange.to]);

  const { data: attendanceRecords = [] } = useAttendanceRecords(attendanceParams);

  const summaryParams = useMemo(() => effectiveSelectedGroupId ? {
    start_date: dateRange.from,
    end_date: dateRange.to,
    group_id: effectiveSelectedGroupId,
  } : undefined, [effectiveSelectedGroupId, dateRange.from, dateRange.to]);

  const { data: attendanceStats } = useAttendanceSummary(summaryParams);
  const createAttendance = useCreateAttendance();

  const dailyAttendanceParams = useMemo(() => selectedDate && effectiveSelectedGroupId ? {
    start_date: selectedDate,
    end_date: selectedDate,
    limit: 100,
    group_id: effectiveSelectedGroupId,
  } : undefined, [selectedDate, effectiveSelectedGroupId]);

  const { data: dailyAttendanceRecords = [] } = useAttendanceRecords(dailyAttendanceParams);

  const dailyAttendance: DailyAttendance | null = useMemo(() => {
    if (!selectedDate || students.length === 0) return null;
    return {
      date: selectedDate,
      students: students.map(student => {
        const editKey = `${selectedDate}_${student.id}`;
        const editStatus = attendanceEdits.get(editKey);
        if (editStatus) {
          return { student_id: student.id, name: student.name, status: editStatus, notes: undefined };
        }
        const record = dailyAttendanceRecords.find((r: Attendance) => r.student_id === student.id);
        return {
          student_id: student.id,
          name: student.name,
          status: record?.status || null,
          notes: record?.notes || undefined
        };
      })
    };
  }, [selectedDate, students, dailyAttendanceRecords, attendanceEdits]);

  const handleAttendanceChange = useCallback((studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    setAttendanceEdits(prev => {
      const next = new Map(prev);
      next.set(`${selectedDate}_${studentId}`, status);
      return next;
    });
  }, [selectedDate]);

  const handleBulkAttendanceSave = async () => {
    if (!dailyAttendance) return;
    try {
      setSaving(true);
      const attendanceData: BulkAttendanceRequest = {
        date: selectedDate,
        attendance: dailyAttendance.students
          .filter(student => student.status !== null)
          .map(student => ({
            student_id: student.student_id,
            group_id: effectiveSelectedGroupId,
            status: student.status!,
            notes: student.notes
          }))
      };
      await createAttendance.mutateAsync(attendanceData);
      setAttendanceEdits(new Map());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setAlertDialog({
        open: true,
        title: tErrors('generic'),
        description: message || tErrors('generic'),
        onConfirm: () => setAlertDialog(prev => ({ ...prev, open: false })),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAllPresent = () => {
    if (!dailyAttendance) return;
    dailyAttendance.students.forEach(student => {
      handleAttendanceChange(student.student_id, 'present');
    });
  };

  const handleMarkAllAbsent = () => {
    if (!dailyAttendance) return;
    dailyAttendance.students.forEach(student => {
      handleAttendanceChange(student.student_id, 'absent');
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') newMonth.setMonth(newMonth.getMonth() - 1);
      else newMonth.setMonth(newMonth.getMonth() + 1);
      return newMonth;
    });
  };

  const filteredRecords = attendanceRecords.filter((record: Attendance) => {
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    const matchesStudent = !studentFilter || record.student?.name?.toLowerCase().includes(studentFilter.toLowerCase());
    const recordDate = new Date(record.date);
    const fromDate = new Date(dateRange.from);
    const toDate = new Date(dateRange.to);
    const matchesDate = recordDate >= fromDate && recordDate <= toDate;
    return matchesStatus && matchesStudent && matchesDate;
  });

  if (offeringsLoading || !effectiveSelectedGroupId) {
    return <LoadingSpinner message={t('loading')} />;
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/20 bg-surface-sage p-4 text-ink">
          <div className="space-y-1">
            <p className="text-sm font-semibold">{t('noGroups')}</p>
            <p className="text-sm text-ink/70">{t('noGroupsDescription')}</p>
          </div>
          <Button asChild variant="outline" className="border-ink/20 text-ink hover:bg-surface-cool">
            <Link href={`/${locale}/dashboard/classes?setup=required`}>{t('setUpGroups')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const viewModes = [
    { id: 'calendar', label: t('calendar'), icon: CalendarDays },
    { id: 'bulk', label: t('bulkEntry'), icon: Users },
    { id: 'list', label: t('listView'), icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
      >
        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
          <SelectTrigger className="min-w-[250px]">
            <SelectValue placeholder={t('selectClass')} />
          </SelectTrigger>
          <SelectContent>
            {offerings.flatMap((offering) =>
              offering.groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {offering.subject.name_en} - {group.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-2" />
          {tCommon('export')}
        </Button>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          {tCommon('import')}
        </Button>
        <Button size="sm" onClick={() => setStatsModalOpen(true)}>
          <BarChart3 className="w-4 h-4 mr-2" />
          {t('statsTitle')}
        </Button>
      </PageHeader>

      <ViewModeTabs
        modes={viewModes}
        active={viewMode}
        onChange={(mode) => setViewMode(mode as 'calendar' | 'list' | 'bulk')}
      />

      {viewMode === 'calendar' && (
        <>
          {!effectiveSelectedGroupId ? (
            <div className="text-center p-12 bg-surface-cool rounded-lg border border-dashed border-ink/20">
              <AlertCircle className="h-12 w-12 text-ink/40 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-ink">{t('pleaseSelectClass')}</h3>
              <p className="text-ink/60">{t('pleaseSelectClassDescription')}</p>
            </div>
          ) : (
            <AttendanceCalendar
              currentMonth={currentMonth}
              selectedDate={selectedDate}
              attendanceRecords={attendanceRecords}
              dailyAttendance={dailyAttendance}
              onDateSelect={setSelectedDate}
              onMonthNavigate={navigateMonth}
            />
          )}
        </>
      )}

      {viewMode === 'bulk' && (
        <>
          {!effectiveSelectedGroupId ? (
            <div className="text-center p-12 bg-surface-cool rounded-lg border border-dashed border-ink/20">
              <AlertCircle className="h-12 w-12 text-ink/40 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-ink">{t('pleaseSelectClass')}</h3>
              <p className="text-ink/60">{t('pleaseSelectClassDescription')}</p>
            </div>
          ) : (
            <AttendanceBulkEntry
              dailyAttendance={dailyAttendance}
              students={students}
              selectedDate={selectedDate}
              saving={saving}
              onDateChange={setSelectedDate}
              onAttendanceChange={handleAttendanceChange}
              onMarkAllPresent={handleMarkAllPresent}
              onMarkAllAbsent={handleMarkAllAbsent}
              onSave={handleBulkAttendanceSave}
            />
          )}
        </>
      )}

      {viewMode === 'list' && (
        <AttendanceList
          records={filteredRecords}
          statusFilter={statusFilter}
          studentFilter={studentFilter}
          onStatusFilterChange={setStatusFilter}
          onStudentFilterChange={setStudentFilter}
          getStatusBadge={statusBadge}
        />
      )}

      <AttendanceStatsModal
        open={isStatsModalOpen}
        onOpenChange={setStatsModalOpen}
        stats={attendanceStats ?? null}
      />

      <ConfirmDialog
        open={alertDialog.open}
        onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, open }))}
        title={alertDialog.title}
        description={alertDialog.description}
        onConfirm={alertDialog.onConfirm}
        variant={alertDialog.variant}
        cancelLabel={tCommon('cancel')}
        confirmLabel={tCommon('confirm')}
      />
    </div>
  );
}
