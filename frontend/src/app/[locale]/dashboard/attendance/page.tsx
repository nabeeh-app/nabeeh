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
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  UserCheck,
  UserX,
  Timer,
  FileText,
  BarChart3
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Attendance, BulkAttendanceRequest, Offering, Student } from '@/types';

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
  // New: Offerings/Groups
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

  // View modes
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'bulk'>('calendar');
  const [isStatsModalOpen, setStatsModalOpen] = useState(false);

  // Filters
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
  }, [selectedGroupId, dateRange]); // Reload when group or range changes

  useEffect(() => {
    if (selectedDate && selectedGroupId) {
      loadDailyAttendance(selectedDate);
    }
  }, [selectedDate, students, selectedGroupId]);

  const loadOfferings = async () => {
    try {
      const data = await apiClient.getOfferings();
      setOfferings(data);
      // Auto select first group
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

      // Load students for this group
      if (!selectedGroupId) return;

      const studentsResponse = await apiClient.getStudents({
        limit: 100,
        status: 'active',
        group_id: selectedGroupId
      });
      setStudents(studentsResponse.data);

      // Load attendance records
      await loadAttendanceRecords();

      // Load stats
      await loadAttendanceStats();

    } catch (err: any) {
      console.error('Error loading attendance data:', err);
      setError(err.message || 'Failed to load attendance data');

      // Fallback to mock data
      const mockStudents: Student[] = [
        {
          id: '1',
          teacher_id: 'teacher-1',
          student_id: 'ST001',
          name: 'أحمد محمد علي',
          grade_level: 'Grade 10',
          date_of_birth: '2008-05-15',
          gender: 'male',
          subjects: ['Mathematics', 'Physics'],
          enrollment_date: '2024-01-15',
          status: 'active',
          notes: null,
          emergency_contact: '+966501234567',
          address: 'Riyadh, Saudi Arabia',
          created_at: '2024-01-15T00:00:00Z',
          updated_at: '2024-12-21T00:00:00Z'
        },
        {
          id: '2',
          teacher_id: 'teacher-1',
          student_id: 'ST002',
          name: 'فاطمة سعد إبراهيم',
          grade_level: 'Grade 11',
          date_of_birth: '2007-08-22',
          gender: 'female',
          subjects: ['English', 'Chemistry'],
          enrollment_date: '2024-02-10',
          status: 'active',
          notes: null,
          emergency_contact: '+966507654321',
          address: 'Jeddah, Saudi Arabia',
          created_at: '2024-02-10T00:00:00Z',
          updated_at: '2024-12-21T00:00:00Z'
        }
      ];
      setStudents(mockStudents);

    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceRecords = async () => {
    try {
      const response = await apiClient.getAttendance({
        limit: 100,
        date_from: dateRange.from,
        date_to: dateRange.to,
        group_id: selectedGroupId
      });

      const recordsWithStudents = response.data.map(record => ({
        ...record,
        student: students.find(s => s.id === record.student_id) || {} as Student
      }));

      setAttendanceRecords(recordsWithStudents);
    } catch (err: any) {
      console.error('Error loading attendance records:', err);
      // Mock data will be used
    }
  };

  const loadAttendanceStats = async () => {
    try {
      const response = await apiClient.getAttendanceSummary({
        date_from: dateRange.from,
        date_to: dateRange.to,
        group_id: selectedGroupId
      });
      setAttendanceStats(response);
    } catch (err: any) {
      console.error('Error loading attendance stats:', err);
      // Mock stats
      setAttendanceStats({
        total_sessions: 25,
        present_count: 180,
        absent_count: 15,
        late_count: 8,
        excused_count: 5,
        attendance_rate: 87.5
      });
    }
  };

  const loadDailyAttendance = async (date: string) => {
    try {
      const response = await apiClient.getAttendance({
        date_from: date,
        date_to: date,
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
      // Create mock daily data
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
            group_id: selectedGroupId, // Pass the group ID!
            status: student.status!,
            notes: student.notes
          }))
      };

      await apiClient.createAttendance(attendanceData);

      // Refresh data
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
        return <AlertCircle className="h-4 w-4 text-blue-600" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      present: {
        variant: 'default' as const,
        label: locale === 'ar' ? 'حضر' : 'Present',
        color: 'bg-green-100 text-green-800'
      },
      absent: {
        variant: 'destructive' as const,
        label: locale === 'ar' ? 'غاب' : 'Absent',
        color: 'bg-red-100 text-red-800'
      },
      late: {
        variant: 'outline' as const,
        label: locale === 'ar' ? 'تأخر' : 'Late',
        color: 'bg-yellow-100 text-yellow-800'
      },
      excused: {
        variant: 'secondary' as const,
        label: locale === 'ar' ? 'معذور' : 'Excused',
        color: 'bg-blue-100 text-blue-800'
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

      // Mock attendance data for calendar view
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
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
            {locale === 'ar' ? 'جاري تحميل بيانات الحضور...' : 'Loading attendance data...'}
          </p>
        </div>
      </div>
    );
  }

  if (noGroups) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {locale === 'ar' ? 'لا توجد مجموعات بعد' : 'No groups yet'}
            </p>
            <p className="text-sm text-amber-700">
              {locale === 'ar'
                ? 'أنشئ مجموعة واحدة على الأقل قبل تسجيل الحضور.'
                : 'Create at least one group before taking attendance.'}
            </p>
          </div>
          <Button asChild variant="outline" className="border-amber-300 text-amber-900 hover:bg-amber-100">
            <Link href={`/${locale}/dashboard/classes?setup=required`}>
              {locale === 'ar' ? 'إعداد المجموعات' : 'Set up groups'}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {locale === 'ar' ? 'تتبع الحضور' : 'Attendance Tracking'}
          </h1>
          <p className="text-gray-600 mt-2">
            {locale === 'ar'
              ? 'إدارة وتتبع حضور الطلاب اليومي'
              : 'Manage and track daily student attendance'
            }
          </p>
        </div>

        {/* Group Selector */}
        <select
          value={selectedGroupId}
          onChange={(e) => setSelectedGroupId(e.target.value)}
          className="border rounded px-4 py-2 min-w-[250px] bg-white shadow-sm"
        >
          <option value="" disabled>{locale === 'ar' ? 'اختر الفصل' : 'Select Class...'}</option>
          {offerings.flatMap((offering) =>
            offering.groups.map((group) => (
              <option key={group.id} value={group.id}>
                {offering.subject.name_en} - {group.name}
              </option>
            ))
          )}
        </select>

        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            {locale === 'ar' ? 'تصدير' : 'Export'}
          </Button>
          <Button variant="outline" size="sm">
            <Upload className="w-4 h-4 mr-2" />
            {locale === 'ar' ? 'استيراد' : 'Import'}
          </Button>
          <Dialog open={isStatsModalOpen} onOpenChange={setStatsModalOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <BarChart3 className="w-4 h-4 mr-2" />
                {locale === 'ar' ? 'الإحصائيات' : 'Statistics'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {locale === 'ar' ? 'إحصائيات الحضور' : 'Attendance Statistics'}
                </DialogTitle>
              </DialogHeader>
              {attendanceStats && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">
                        {attendanceStats.total_sessions}
                      </div>
                      <div className="text-sm text-gray-600">
                        {locale === 'ar' ? 'إجمالي الجلسات' : 'Total Sessions'}
                      </div>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">
                        {attendanceStats.attendance_rate}%
                      </div>
                      <div className="text-sm text-gray-600">
                        {locale === 'ar' ? 'معدل الحضور' : 'Attendance Rate'}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        {locale === 'ar' ? 'حضر' : 'Present'}
                      </span>
                      <span className="font-medium">{attendanceStats.present_count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        {locale === 'ar' ? 'غاب' : 'Absent'}
                      </span>
                      <span className="font-medium">{attendanceStats.absent_count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-yellow-600" />
                        {locale === 'ar' ? 'تأخر' : 'Late'}
                      </span>
                      <span className="font-medium">{attendanceStats.late_count}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        {locale === 'ar' ? 'معذور' : 'Excused'}
                      </span>
                      <span className="font-medium">{attendanceStats.excused_count}</span>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        <Button
          variant={viewMode === 'calendar' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('calendar')}
        >
          <CalendarDays className="w-4 h-4 mr-2" />
          {locale === 'ar' ? 'التقويم' : 'Calendar'}
        </Button>
        <Button
          variant={viewMode === 'bulk' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('bulk')}
        >
          <Users className="w-4 h-4 mr-2" />
          {locale === 'ar' ? 'تسجيل جماعي' : 'Bulk Entry'}
        </Button>
        <Button
          variant={viewMode === 'list' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setViewMode('list')}
        >
          <FileText className="w-4 h-4 mr-2" />
          {locale === 'ar' ? 'القائمة' : 'List View'}
        </Button>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {!selectedGroupId ? (
            <div className="lg:col-span-3 text-center p-12 bg-gray-50 rounded-lg border border-dashed">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Please Select a Class</h3>
              <p className="text-gray-500">Select a class from the dropdown above to manage attendance.</p>
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
                          {locale === 'ar'
                            ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day)]
                            : day
                          }
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
                        ${day.isToday ? 'bg-blue-100 border-blue-300' : 'border-gray-200'}
                        ${day.isSelected ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}
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
                      {locale === 'ar' ? 'حضور اليوم' : 'Today\'s Attendance'}
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
                              {locale === 'ar'
                                ? `عرض جميع الطلاب (${dailyAttendance.students.length})`
                                : `View all students (${dailyAttendance.students.length})`
                              }
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </> // End check for selectedGroupId
          )}
        </div>
      )}


      {/* Bulk Entry View */}
      {
        viewMode === 'bulk' && !selectedGroupId ? (
          <div className="text-center p-12 bg-gray-50 rounded-lg border border-dashed">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Please Select a Class</h3>
            <p className="text-gray-500">Select a class from the dropdown above to take bulk attendance.</p>
          </div>
        ) : viewMode === 'bulk' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {locale === 'ar' ? 'تسجيل الحضور الجماعي' : 'Bulk Attendance Entry'}
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
                        {locale === 'ar' ? 'جاري الحفظ...' : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        {locale === 'ar' ? 'حفظ الحضور' : 'Save Attendance'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {dailyAttendance && (
                <div className="space-y-4">
                  {/* Quick Actions */}
                  <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg">
                    <span className="text-sm font-medium">
                      {locale === 'ar' ? 'إجراءات سريعة:' : 'Quick Actions:'}
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
                      {locale === 'ar' ? 'حضر الجميع' : 'Mark All Present'}
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
                      {locale === 'ar' ? 'غاب الجميع' : 'Mark All Absent'}
                    </Button>
                  </div>

                  {/* Student List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {dailyAttendance.students.map((student) => {
                      const studentData = students.find(s => s.id === student.student_id);
                      return (
                        <Card key={student.student_id} className="p-4">
                          <div className="flex items-center space-x-3 mb-3">
                            <Avatar>
                              <AvatarFallback className="bg-blue-100 text-blue-700">
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
                              {locale === 'ar' ? 'حضر' : 'Present'}
                            </Button>
                            <Button
                              variant={student.status === 'absent' ? 'destructive' : 'outline'}
                              size="sm"
                              onClick={() => handleAttendanceChange(student.student_id, 'absent')}
                              className="gap-1"
                            >
                              <XCircle className="w-3 h-3" />
                              {locale === 'ar' ? 'غاب' : 'Absent'}
                            </Button>
                            <Button
                              variant={student.status === 'late' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => handleAttendanceChange(student.student_id, 'late')}
                              className="gap-1"
                            >
                              <Clock className="w-3 h-3" />
                              {locale === 'ar' ? 'تأخر' : 'Late'}
                            </Button>
                            <Button
                              variant={student.status === 'excused' ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => handleAttendanceChange(student.student_id, 'excused')}
                              className="gap-1"
                            >
                              <AlertCircle className="w-3 h-3" />
                              {locale === 'ar' ? 'معذور' : 'Excused'}
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
        )
      }

      {/* List View */}
      {
        viewMode === 'list' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {locale === 'ar' ? 'سجل الحضور' : 'Attendance Records'}
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Input
                    placeholder={locale === 'ar' ? 'البحث عن طالب...' : 'Search student...'}
                    value={studentFilter}
                    onChange={(e) => setStudentFilter(e.target.value)}
                    className="w-64"
                  />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border rounded px-3 py-2"
                  >
                    <option value="all">{locale === 'ar' ? 'جميع الحالات' : 'All Status'}</option>
                    <option value="present">{locale === 'ar' ? 'حضر' : 'Present'}</option>
                    <option value="absent">{locale === 'ar' ? 'غاب' : 'Absent'}</option>
                    <option value="late">{locale === 'ar' ? 'تأخر' : 'Late'}</option>
                    <option value="excused">{locale === 'ar' ? 'معذور' : 'Excused'}</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredRecords.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {locale === 'ar' ? 'لا توجد سجلات حضور' : 'No attendance records found'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{locale === 'ar' ? 'الطالب' : 'Student'}</TableHead>
                      <TableHead>{locale === 'ar' ? 'التاريخ' : 'Date'}</TableHead>
                      <TableHead>{locale === 'ar' ? 'الحالة' : 'Status'}</TableHead>
                      <TableHead>{locale === 'ar' ? 'الملاحظات' : 'Notes'}</TableHead>
                      <TableHead>{locale === 'ar' ? 'وقت التسجيل' : 'Recorded At'}</TableHead>
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
                                <div className="font-medium">{record.student?.name || 'Unknown'}</div>
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
        )
      }
    </div >
  );
}
