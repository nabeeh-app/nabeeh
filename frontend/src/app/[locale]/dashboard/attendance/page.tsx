'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Calendar,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  Upload,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  UserCheck,
  FileText,
  BarChart3
} from 'lucide-react';
import { BulkAttendanceRequest, Student, Attendance } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ViewModeTabs } from '@/components/ui/ViewModeTabs';
import { useOfferings } from '@/hooks/useOfferings';
import { useStudents } from '@/hooks/useStudents';
import { useAttendanceRecords, useAttendanceSummary, useCreateAttendance } from '@/hooks/useAttendance';
import logger from '@/lib/logger';
import { apiClient } from '@/lib/client';

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
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'bulk'>('calendar');
  const [isStatsModalOpen, setStatsModalOpen] = useState(false);
  const [dailyAttendance, setDailyAttendance] = useState<DailyAttendance | null>(null);
  const [saving, setSaving] = useState(false);

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

  const groups = useMemo(() => offerings.flatMap(o => o.groups ?? []), [offerings]);

  useEffect(() => {
    if (groups.length === 0 && !offeringsLoading) {
      router.replace(`/${locale}/dashboard/classes?setup=required`);
    }
  }, [groups, offeringsLoading, locale, router]);

  const effectiveSelectedGroupId = useMemo(
    () => selectedGroupId || groups[0]?.id || '',
    [selectedGroupId, groups]
  );

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
  } : undefined, [effectiveSelectedGroupId, dateRange]);

  const { data: attendanceResponse } = useAttendanceRecords(attendanceParams);
  const attendanceRecords = useMemo(() => attendanceResponse?.data ?? [], [attendanceResponse]);

  const summaryParams = useMemo(() => effectiveSelectedGroupId ? {
    start_date: dateRange.from,
    end_date: dateRange.to,
    group_id: effectiveSelectedGroupId,
  } : undefined, [effectiveSelectedGroupId, dateRange]);

  const { data: attendanceStats } = useAttendanceSummary(summaryParams);
  const createAttendance = useCreateAttendance();

  useEffect(() => {
    if (!selectedDate || !effectiveSelectedGroupId || students.length === 0) return;

    let cancelled = false;

    apiClient.getAttendance({
      start_date: selectedDate,
      end_date: selectedDate,
      limit: 100,
      group_id: effectiveSelectedGroupId
    }).then((response: { data: Attendance[] }) => {
      if (cancelled) return;
      setDailyAttendance({
        date: selectedDate,
        students: students.map(student => {
          const attendanceRecord = response.data.find((record: Attendance) => record.student_id === student.id);
          return {
            student_id: student.id,
            name: student.name,
            status: attendanceRecord?.status || null,
            notes: attendanceRecord?.notes || undefined
          };
        })
      });
    }).catch((err: unknown) => {
      if (cancelled) return;
      logger.error('Error loading daily attendance:', err);
      setDailyAttendance({
        date: selectedDate,
        students: students.map(student => ({
          student_id: student.id,
          name: student.name,
          status: null,
          notes: undefined
        }))
      });
    });

    return () => { cancelled = true; };
  }, [selectedDate, students, effectiveSelectedGroupId]);

  const handleAttendanceChange = (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    if (!dailyAttendance) return;
    setDailyAttendance(prev => {
      if (!prev) return null;
      return {
        ...prev,
        students: prev.students.map(student =>
          student.student_id === studentId ? { ...student, status } : student
        )
      };
    });
  };

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Error saving attendance:', err);
      setAlertDialog({
        open: true,
        title: t('errors.generic'),
        description: message || t('errors.generic'),
        onConfirm: () => setAlertDialog(prev => ({ ...prev, open: false })),
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-4 w-4 text-[#026370]" />;
      case 'absent': return <XCircle className="h-4 w-4 text-[#c53030]" />;
      case 'late': return <Clock className="h-4 w-4 text-ink/70" />;
      case 'excused': return <AlertCircle className="h-4 w-4 text-primary" />;
      default: return <div className="h-4 w-4 rounded-pill border-2 border-ink/20" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      present: { variant: 'default' as const, label: t('attendance.status.present'), color: 'bg-surface-sage text-ink' },
      absent: { variant: 'destructive' as const, label: t('attendance.status.absent'), color: 'bg-[#c53030]/10 text-[#c53030]' },
      late: { variant: 'outline' as const, label: t('attendance.status.late'), color: 'bg-surface-cool text-ink/70' },
      excused: { variant: 'secondary' as const, label: t('attendance.status.excused'), color: 'bg-primary/10 text-primary' }
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.present;
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    const days = [];
    const current = new Date(startDate);
    for (let i = 0; i < 42; i++) {
      const dateStr = current.toISOString().split('T')[0];
      const isCurrentMonth = current.getMonth() === month;
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      const isSelected = dateStr === selectedDate;
      const hasAttendance = attendanceRecords.some((record: Attendance) => record.date === dateStr);
      days.push({ date: new Date(current), dateStr, isCurrentMonth, isToday, isSelected, hasAttendance });
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') newMonth.setMonth(newMonth.getMonth() - 1);
      else newMonth.setMonth(newMonth.getMonth() + 1);
      return newMonth;
    });
  };

  const filteredRecords = useMemo(() => {
    return attendanceRecords.filter((record: Attendance) => {
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
      const matchesStudent = !studentFilter || record.student?.name?.toLowerCase().includes(studentFilter.toLowerCase());
      const recordDate = new Date(record.date);
      const fromDate = new Date(dateRange.from);
      const toDate = new Date(dateRange.to);
      const matchesDate = recordDate >= fromDate && recordDate <= toDate;
      return matchesStatus && matchesStudent && matchesDate;
    });
  }, [attendanceRecords, statusFilter, studentFilter, dateRange]);

  if (offeringsLoading || !effectiveSelectedGroupId) {
    return <LoadingSpinner message={t('attendance.loading')} />;
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/20 bg-surface-sage p-4 text-ink">
          <div className="space-y-1">
            <p className="text-sm font-semibold">{t('attendance.noGroups')}</p>
            <p className="text-sm text-ink/70">{t('attendance.noGroupsDescription')}</p>
          </div>
          <Button asChild variant="outline" className="border-ink/20 text-ink hover:bg-surface-cool">
            <Link href={`/${locale}/dashboard/classes?setup=required`}>{t('attendance.setUpGroups')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const viewModes = [
    { id: 'calendar', label: t('attendance.calendar'), icon: CalendarDays },
    { id: 'bulk', label: t('attendance.bulkEntry'), icon: Users },
    { id: 'list', label: t('attendance.listView'), icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('attendance.title')}
        description={t('attendance.description')}
      >
        <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
          <SelectTrigger className="min-w-[250px]">
            <SelectValue placeholder={t('attendance.selectClass')} />
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
          {t('common.export')}
        </Button>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          {t('common.import')}
        </Button>
        <Dialog open={isStatsModalOpen} onOpenChange={setStatsModalOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <BarChart3 className="w-4 h-4 mr-2" />
              {t('attendance.statsTitle')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('attendance.statsTitle')}</DialogTitle>
            </DialogHeader>
            {attendanceStats && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-surface-sage rounded-lg">
                    <div className="text-2xl font-bold text-ink">{attendanceStats.total_sessions}</div>
                    <div className="text-sm text-ink/60">{t('attendance.totalSessions')}</div>
                  </div>
                  <div className="text-center p-4 bg-surface-sage rounded-lg">
                    <div className="text-2xl font-bold text-[#026370]">{attendanceStats.attendance_rate}%</div>
                    <div className="text-sm text-ink/60">{t('attendance.attendanceRate')}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-[#026370]" />
                      {t('attendance.status.present')}
                    </span>
                    <span className="font-medium">{attendanceStats.present_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-[#c53030]" />
                      {t('attendance.status.absent')}
                    </span>
                    <span className="font-medium">{attendanceStats.absent_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-ink/70" />
                      {t('attendance.status.late')}
                    </span>
                    <span className="font-medium">{attendanceStats.late_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-primary" />
                      {t('attendance.status.excused')}
                    </span>
                    <span className="font-medium">{attendanceStats.excused_count}</span>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageHeader>

      <ViewModeTabs
        modes={viewModes}
        active={viewMode}
        onChange={(mode) => setViewMode(mode as 'calendar' | 'list' | 'bulk')}
      />

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {!effectiveSelectedGroupId ? (
            <div className="lg:col-span-3 text-center p-12 bg-surface-cool rounded-lg border border-dashed border-ink/20">
              <AlertCircle className="h-12 w-12 text-ink/40 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-ink">{t('attendance.pleaseSelectClass')}</h3>
              <p className="text-ink/60">{t('attendance.pleaseSelectClassDescription')}</p>
            </div>
          ) : (
            <>
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>
                        {currentMonth.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                          year: 'numeric', month: 'long'
                        })}
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')} aria-label={t('common.previous')}>
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigateMonth('next')} aria-label={t('common.next')}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-7 gap-1.5 mb-4">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="p-2 text-center text-sm font-medium text-ink/60">
                          {t(`attendance.days.${day.toLowerCase()}`)}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {generateCalendarDays().map((day, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedDate(day.dateStr)}
                          aria-label={day.date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          className={`
                            p-2 min-h-[44px] text-sm rounded-lg border transition-colors
                            ${day.isCurrentMonth ? 'text-ink' : 'text-ink/40'}
                            ${day.isToday ? 'bg-primary/10 border-primary/30' : 'border-ink/20'}
                            ${day.isSelected ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-surface-cool'}
                            ${day.hasAttendance ? 'font-semibold' : ''}
                          `}
                        >
                          <div>{day.date.getDate()}</div>
                          {day.hasAttendance && (
                            <div className="w-1 h-1 bg-[#026370] rounded-full mx-auto mt-1"></div>
                          )}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('attendance.todayAttendance')}</CardTitle>
                    <p className="text-sm text-ink/60">
                      {new Date(selectedDate).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                    </p>
                  </CardHeader>
                  <CardContent>
                    {dailyAttendance && (
                      <div className="space-y-3">
                        {dailyAttendance.students.slice(0, 5).map((student) => (
                          <div key={student.student_id} className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="bg-surface-cool text-ink/60 text-xs">
                                  {student.name.split(' ')[0].charAt(0)}
                                  {student.name.split(' ')[1]?.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium">{student.name}</span>
                            </div>
                            {getStatusIcon(student.status)}
                          </div>
                        ))}
                        {dailyAttendance.students.length > 5 && (
                          <div className="text-center">
                            <Button variant="ghost" size="sm" onClick={() => setViewMode('bulk')}>
                              {t('attendance.viewAllStudents', { count: dailyAttendance.students.length })}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* Bulk Entry View */}
      {viewMode === 'bulk' && !effectiveSelectedGroupId ? (
        <div className="text-center p-12 bg-surface-cool rounded-lg border border-dashed border-ink/20">
          <AlertCircle className="h-12 w-12 text-ink/40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-ink">{t('attendance.pleaseSelectClass')}</h3>
          <p className="text-ink/60">{t('attendance.pleaseSelectClassDescription')}</p>
        </div>
      ) : viewMode === 'bulk' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{t('attendance.bulkAttendanceEntry')}</CardTitle>
                <p className="text-sm text-ink/60 mt-1">
                  {new Date(selectedDate).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-auto" />
                <Button onClick={handleBulkAttendanceSave} disabled={saving} className="gap-2">
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {t('attendance.saving')}
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      {t('attendance.actions.saveAttendance')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {dailyAttendance && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 p-4 bg-surface-cool rounded-lg">
                  <span className="text-sm font-medium">{t('attendance.quickActions')}</span>
                  <Button variant="outline" size="sm" onClick={() => {
                    dailyAttendance.students.forEach(student => {
                      handleAttendanceChange(student.student_id, 'present');
                    });
                  }}>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {t('attendance.markAllPresent')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    dailyAttendance.students.forEach(student => {
                      handleAttendanceChange(student.student_id, 'absent');
                    });
                  }}>
                    <XCircle className="w-4 h-4 mr-1" />
                    {t('attendance.markAllAbsent')}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dailyAttendance.students.map((student) => {
                    const studentData = students.find(s => s.id === student.student_id);
                    return (
                      <Card key={student.student_id} className="p-4">
                        <div className="flex items-center space-x-3 mb-3">
                          <Avatar>
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {student.name.split(' ')[0].charAt(0)}
                              {student.name.split(' ')[1]?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{student.name}</div>
                            <div className="text-xs text-ink/60">{studentData?.grade_level}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant={student.status === 'present' ? 'default' : 'outline'} size="sm" onClick={() => handleAttendanceChange(student.student_id, 'present')} className="gap-1">
                            <CheckCircle className="w-3 h-3" />
                            {t('attendance.status.present')}
                          </Button>
                          <Button variant={student.status === 'absent' ? 'destructive' : 'outline'} size="sm" onClick={() => handleAttendanceChange(student.student_id, 'absent')} className="gap-1">
                            <XCircle className="w-3 h-3" />
                            {t('attendance.status.absent')}
                          </Button>
                          <Button variant={student.status === 'late' ? 'default' : 'outline'} size="sm" onClick={() => handleAttendanceChange(student.student_id, 'late')} className="gap-1">
                            <Clock className="w-3 h-3" />
                            {t('attendance.status.late')}
                          </Button>
                          <Button variant={student.status === 'excused' ? 'secondary' : 'outline'} size="sm" onClick={() => handleAttendanceChange(student.student_id, 'excused')} className="gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {t('attendance.status.excused')}
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-ink font-display">{t('attendance.attendanceRecords')}</h2>
            <div className="flex items-center space-x-2">
              <Input placeholder={t('attendance.searchStudent')} value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)} className="w-64" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="min-w-[150px]">
                  <SelectValue placeholder={t('attendance.allStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('attendance.allStatus')}</SelectItem>
                  <SelectItem value="present">{t('attendance.status.present')}</SelectItem>
                  <SelectItem value="absent">{t('attendance.status.absent')}</SelectItem>
                  <SelectItem value="late">{t('attendance.status.late')}</SelectItem>
                  <SelectItem value="excused">{t('attendance.status.excused')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {filteredRecords.length === 0 ? (
            <EmptyState icon={Calendar} message={t('attendance.noRecords')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('attendance.student')}</TableHead>
                  <TableHead>{t('attendance.date')}</TableHead>
                  <TableHead>{t('attendance.statusLabel')}</TableHead>
                  <TableHead>{t('attendance.notes')}</TableHead>
                  <TableHead>{t('attendance.recordedAt')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record: Attendance) => {
                  const status = getStatusBadge(record.status);
                  return (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-surface-cool text-ink/60">
                              {record.student?.name?.split(' ')[0]?.charAt(0)}
                              {record.student?.name?.split(' ')[1]?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{record.student?.name || t('attendance.unknown')}</div>
                            <div className="text-sm text-ink/60">{record.student?.grade_level}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(record.date).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className={status.color}>{status.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-ink/60">{record.notes || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-ink/60">
                          {new Date(record.created_at).toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US')}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <AlertDialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog(prev => ({ ...prev, open }))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{alertDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{alertDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className={alertDialog.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              onClick={() => {
                alertDialog.onConfirm();
                setAlertDialog(prev => ({ ...prev, open: false }));
              }}
            >
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
