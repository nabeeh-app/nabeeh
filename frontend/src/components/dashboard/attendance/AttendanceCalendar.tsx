'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { Attendance } from '@/types';

interface DailyAttendance {
  date: string;
  students: {
    student_id: string;
    name: string;
    status: 'present' | 'absent' | 'late' | 'excused' | null;
    notes?: string;
  }[];
}

interface AttendanceCalendarProps {
  currentMonth: Date;
  selectedDate: string;
  attendanceRecords: Attendance[];
  dailyAttendance: DailyAttendance | null;
  onDateSelect: (date: string) => void;
  onMonthNavigate: (direction: 'prev' | 'next') => void;
}

export default function AttendanceCalendar({
  currentMonth,
  selectedDate,
  attendanceRecords,
  dailyAttendance,
  onDateSelect,
  onMonthNavigate,
}: AttendanceCalendarProps) {
  const t = useTranslations();
  const locale = useLocale();

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

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'present': return <CheckCircle className="h-4 w-4 text-primary" />;
      case 'absent': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'late': return <Clock className="h-4 w-4 text-ink/70" />;
      case 'excused': return <AlertCircle className="h-4 w-4 text-primary" />;
      default: return <div className="h-4 w-4 rounded-pill border-2 border-ink/20" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <Button variant="outline" size="sm" onClick={() => onMonthNavigate('prev')} aria-label={t('common.previous')}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => onMonthNavigate('next')} aria-label={t('common.next')}>
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
                  onClick={() => onDateSelect(day.dateStr)}
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
                    <div className="w-1 h-1 bg-primary rounded-full mx-auto mt-1"></div>
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
                    <p className="text-sm text-ink/60">
                      {t('attendance.viewAllStudents', { count: dailyAttendance.students.length })}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
