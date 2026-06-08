'use client';

import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
  Search,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  UserCheck,
  Timer,
  FileText,
  BarChart3
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Attendance, BulkAttendanceRequest, Offering, Student } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ViewModeTabs } from '@/components/ui/ViewModeTabs';

interface AttendanceWithStudent extends Attendance {
  student: Student;
}

interface AttendanceStats {
  total_sessions: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
  attendance_rate: number;
}

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
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [noGroups, setNoGroups] = useState(false);

  const [students, setStudents] = useState<Student[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceWithStudent[]>([]);
  const [dailyAttendance, setDailyAttendance] = useState<DailyAttendance | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'bulk'>('calendar');
  const [isStatsModalOpen, setStatsModalOpen] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [studentFilter, setStudentFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    loadOfferings();
  }, []);

  useEffect(() => {
    if (selectedGroupId && selectedGroupId !== '') {
      loadInitialData();
    }
  }, [selectedGroupId, dateRange]);

  useEffect(() => {
    if (selectedDate && selectedGroupId) {
      loadDailyAttendance(selectedDate);
    }
  }, [selectedDate, students, selectedGroupId]);

  const loadOfferings = async () => {
    try {
      const data = await apiClient.getOfferings();
      setOfferings(data);
      const groups = data.flatMap((offering) => offering.groups ?? []);
      if (groups.length === 0) {
        setNoGroups(true);
        setLoading(false);
        router.replace(`/${locale}/dashboard/classes?setup=required`);
        return;
      }
      setNoGroups(false);
      const firstGroup = groups[0];
      if (firstGroup) setSelectedGroupId(firstGroup.id);
    } catch (err) {
      console.error(err);
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!selectedGroupId) return;

      const studentsResponse = await apiClient.getStudents({
        limit: 100,
        status: 'active',
        group_id: selectedGroupId
      });
      setStudents(studentsResponse.data);

      await loadAttendanceRecords();
      await loadAttendanceStats();

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load attendance data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceRecords = async () => {
    try {
      const response = await apiClient.getAttendance({
        limit: 100,
        start_date: dateRange.from,
        end_date: dateRange.to,
        group_id: selectedGroupId
      });

      const recordsWithStudents = response.data.map(record => ({
        ...record,
        student: students.find(s => s.id === record.student_id) || {} as Student
      }));

      setAttendanceRecords(recordsWithStudents);
    } catch (err: any) {
      console.error('Error loading attendance records:', err);
    }
  };

  const loadAttendanceStats = async () => {
    try {
      const response = await apiClient.getAttendanceSummary({
        start_date: dateRange.from,
        end_date: dateRange.to,
        group_id: selectedGroupId
      });
      setAttendanceStats(response);
    } catch (err: any) {
      console.error('Error loading attendance stats:', err);
      setAttendanceStats(null);
    }
  };

  const loadDailyAttendance = async (date: string) => {
    try {
      const response = await apiClient.getAttendance({
        start_date: date,
        end_date: date,
        limit: 100,
        group_id: selectedGroupId
      });

      const dailyData: DailyAttendance = {
        date,
        students: students.map(student => {
          const attendanceRecord = response.data.find(record => record.student_id === student.id);
          return {
            student_id: student.id,
            name: student.name,
            status: attendanceRecord?.status || null,
            notes: attendanceRecord?.notes || undefined
          };
        })
      };

      setDailyAttendance(dailyData);
    } catch (err: any) {
      console.error('Error loading daily attendance:', err);
      setDailyAttendance({
        date,
        students: students.map(student => ({
          student_id: student.id,
          name: student.name,
          status: null,
          notes: undefined
        }))
      });
    }
  };

  const handleAttendanceChange = (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => {
    if (!dailyAttendance) return;

    setDailyAttendance(prev => {
      if (!prev) return null;
      return {
        ...prev,
        students: prev.students.map(student =>
          student.student_id === studentId
            ? { ...student, status }
            : student
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
            group_id: selectedGroupId,
            status: student.status!,
            notes: student.notes
          }))
      };

      await apiClient.createAttendance(attendanceData);

      await loadAttendanceRecords();
      await loadAttendanceStats();

    } catch (err: any) {
      console.error('Error saving attendance:', err);
      alert(err.message || 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'present':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'absent':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'late':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'excused':
        return <AlertCircle className="h-4 w-4 text-primary" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      present: {
        variant: 'default' as const,
        label: t('attendance.status.present'),
        color: 'bg-green-100 text-green-800'
      },
      absent: {
        variant: 'destructive' as const,
        label: t('attendance.status.absent'),
        color: 'bg-red-100 text-red-800'
      },
      late: {
        variant: 'outline' as const,
        label: t('attendance.status.late'),
        color: 'bg-yellow-100 text-yellow-800'
      },
      excused: {
        variant: 'secondary' as const,
        label: t('attendance.status.excused'),
        color: 'bg-primary/10 text-primary'
      }
    };

    return statusMap[status as keyof typeof statusMap] || statusMap.present;
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const current = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      const dateStr = current.toISOString().split('T')[0];
      const isCurrentMonth = current.getMonth() === month;
      const isToday = dateStr === new Date().toISOString().split('T')[0];
      const isSelected = dateStr === selectedDate;

      const hasAttendance = attendanceRecords.some(record => record.date === dateStr);

      days.push({
        date: new Date(current),
        dateStr,
        isCurrentMonth,
        isToday,
        isSelected,
        hasAttendance
      });

      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1);
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const filteredRecords = attendanceRecords.filter(record => {
    const matchesStatus = statusFilter === 'all' || record.status === statusFilter;
    const matchesStudent = !studentFilter ||
      record.student?.name?.toLowerCase().includes(studentFilter.toLowerCase());
    const recordDate = new Date(record.date);
    const fromDate = new Date(dateRange.from);
    const toDate = new Date(dateRange.to);
    const matchesDate = recordDate >= fromDate && recordDate <= toDate;

    return matchesStatus && matchesStudent && matchesDate;
  });

  if (loading) {
    return <LoadingSpinner message={t('attendance.loading')} />;
  }

  if (noGroups) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {t('attendance.noGroups')}
            </p>
            <p className="text-sm text-amber-700">
              {t('attendance.noGroupsDescription')}
            </p>
          </div>
          <Button asChild variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-100">
            <Link href={`/${locale}/dashboard/classes?setup=required`}>
              {t('attendance.setUpGroups')}
            </Link>
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
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="border rounded px-4 py-2 min-w-[250px] bg-white shadow-sm"
        >
          <option value="" disabled>{t('attendance.selectClass')}</option>
          {offerings.flatMap((offering) =>
            offering.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {offering.subject.name_en} - {group.name}
              </option>
            ))
          )}
        </select>
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
              <DialogTitle>
                {t('attendance.statsTitle')}
              </DialogTitle>
            </DialogHeader>
            {attendanceStats && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-primary/5 rounded-lg">
                    <div className="text-2xl font-bold text-primary">
                      {attendanceStats.total_sessions}
                    </div>
                    <div className="text-sm text-gray-600">
                      {t('attendance.totalSessions')}
                    </div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {attendanceStats.attendance_rate}%
                    </div>
                    <div className="text-sm text-gray-600">
                      {t('attendance.attendanceRate')}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      {t('attendance.status.present')}
                    </span>
                    <span className="font-medium">{attendanceStats.present_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      {t('attendance.status.absent')}
                    </span>
                    <span className="font-medium">{attendanceStats.absent_count}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-yellow-600" />
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
          {!selectedGroupId ? (
            <div className="lg:col-span-3 text-center p-12 bg-gray-50 rounded-lg border border-dashed">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">{t('attendance.pleaseSelectClass')}</h3>
              <p className="text-gray-500">{t('attendance.pleaseSelectClassDescription')}</p>
            </div>
          ) : (
            <>
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>
                        {currentMonth.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                          year: 'numeric',
                          month: 'long'
                        })}
                      </CardTitle>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm" onClick={() => navigateMonth('prev')}>
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigateMonth('next')}>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-7 gap-1 mb-4">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
                          {t(`attendance.days.${day.toLowerCase()}`)}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {generateCalendarDays().map((day, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedDate(day.dateStr)}
                          className={`
                            p-2 text-sm rounded-lg border transition-colors
                            ${day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                            ${day.isToday ? 'bg-primary/10 border-primary/30' : 'border-gray-200'}
                            ${day.isSelected ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-gray-50'}
                            ${day.hasAttendance ? 'font-semibold' : ''}
                          `}
                        >
                          <div>{day.date.getDate()}</div>
                          {day.hasAttendance && (
                            <div className="w-1 h-1 bg-green-500 rounded-full mx-auto mt-1"></div>
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
                    <CardTitle>
                      {t('attendance.todayAttendance')}
                    </CardTitle>
                    <p className="text-sm text-gray-600">
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
                                <AvatarFallback className="bg-gray-100 text-gray-600 text-xs">
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewMode('bulk')}
                            >
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
      {viewMode === 'bulk' && !selectedGroupId ? (
        <div className="text-center p-12 bg-gray-50 rounded-lg border border-dashed">
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">{t('attendance.pleaseSelectClass')}</h3>
          <p className="text-gray-500">{t('attendance.pleaseSelectClassDescription')}</p>
        </div>
      ) : viewMode === 'bulk' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {t('attendance.bulkAttendanceEntry')}
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {new Date(selectedDate).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-auto"
                />
                <Button
                  onClick={handleBulkAttendanceSave}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      {t('attendance.saving')}
                    </>
                  ) : (
                    <>
                      <UserCheck className="w-4 h-4" />
                      {t('attendance.saveAttendance')}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {dailyAttendance && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">
                    {t('attendance.quickActions')}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      dailyAttendance.students.forEach(student => {
                        handleAttendanceChange(student.student_id, 'present');
                      });
                    }}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    {t('attendance.markAllPresent')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      dailyAttendance.students.forEach(student => {
                        handleAttendanceChange(student.student_id, 'absent');
                      });
                    }}
                  >
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
                            <div className="text-xs text-gray-500">
                              {studentData?.grade_level}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant={student.status === 'present' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleAttendanceChange(student.student_id, 'present')}
                            className="gap-1"
                          >
                            <CheckCircle className="w-3 h-3" />
                            {t('attendance.status.present')}
                          </Button>
                          <Button
                            variant={student.status === 'absent' ? 'destructive' : 'outline'}
                            size="sm"
                            onClick={() => handleAttendanceChange(student.student_id, 'absent')}
                            className="gap-1"
                          >
                            <XCircle className="w-3 h-3" />
                            {t('attendance.status.absent')}
                          </Button>
                          <Button
                            variant={student.status === 'late' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleAttendanceChange(student.student_id, 'late')}
                            className="gap-1"
                          >
                            <Clock className="w-3 h-3" />
                            {t('attendance.status.late')}
                          </Button>
                          <Button
                            variant={student.status === 'excused' ? 'secondary' : 'outline'}
                            size="sm"
                            onClick={() => handleAttendanceChange(student.student_id, 'excused')}
                            className="gap-1"
                          >
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
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {t('attendance.attendanceRecords')}
              </CardTitle>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder={t('attendance.searchStudent')}
                  value={studentFilter}
                  onChange={(e) => setStudentFilter(e.target.value)}
                  className="w-64"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border rounded px-3 py-2"
                >
                  <option value="all">{t('attendance.allStatus')}</option>
                  <option value="present">{t('attendance.status.present')}</option>
                  <option value="absent">{t('attendance.status.absent')}</option>
                  <option value="late">{t('attendance.status.late')}</option>
                  <option value="excused">{t('attendance.status.excused')}</option>
                </select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredRecords.length === 0 ? (
              <EmptyState
                icon={Calendar}
                message={t('attendance.noRecords')}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('attendance.student')}</TableHead>
                    <TableHead>{t('attendance.date')}</TableHead>
                    <TableHead>{t('attendance.status')}</TableHead>
                    <TableHead>{t('attendance.notes')}</TableHead>
                    <TableHead>{t('attendance.recordedAt')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => {
                    const status = getStatusBadge(record.status);
                    return (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-gray-100 text-gray-600">
                                {record.student?.name?.split(' ')[0]?.charAt(0)}
                                {record.student?.name?.split(' ')[1]?.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{record.student?.name || t('attendance.unknown')}</div>
                              <div className="text-sm text-gray-500">
                                {record.student?.grade_level}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(record.date).toLocaleDateString(
                            locale === 'ar' ? 'ar-SA' : 'en-US'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} className={status.color}>
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {record.notes || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-500">
                            {new Date(record.created_at).toLocaleString(
                              locale === 'ar' ? 'ar-SA' : 'en-US'
                            )}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
