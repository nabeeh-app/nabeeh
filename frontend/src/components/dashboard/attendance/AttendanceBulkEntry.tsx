'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { CheckCircle, XCircle, Clock, AlertCircle, UserCheck } from 'lucide-react';
import { Student } from '@/types';

interface DailyAttendance {
  date: string;
  students: {
    student_id: string;
    name: string;
    status: 'present' | 'absent' | 'late' | 'excused' | null;
    notes?: string;
  }[];
}

interface AttendanceBulkEntryProps {
  dailyAttendance: DailyAttendance | null;
  students: Student[];
  selectedDate: string;
  saving: boolean;
  onDateChange: (date: string) => void;
  onAttendanceChange: (studentId: string, status: 'present' | 'absent' | 'late' | 'excused') => void;
  onMarkAllPresent: () => void;
  onMarkAllAbsent: () => void;
  onSave: () => void;
}

export default function AttendanceBulkEntry({
  dailyAttendance,
  students,
  selectedDate,
  saving,
  onDateChange,
  onAttendanceChange,
  onMarkAllPresent,
  onMarkAllAbsent,
  onSave,
}: AttendanceBulkEntryProps) {
  const t = useTranslations();
  const locale = useLocale();

  return (
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
            <Input type="date" value={selectedDate} onChange={(e) => onDateChange(e.target.value)} className="w-auto" />
            <Button onClick={onSave} disabled={saving} className="gap-2">
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
              <Button variant="outline" size="sm" onClick={onMarkAllPresent}>
                <CheckCircle className="w-4 h-4 mr-1" />
                {t('attendance.markAllPresent')}
              </Button>
              <Button variant="outline" size="sm" onClick={onMarkAllAbsent}>
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
                      <Button variant={student.status === 'present' ? 'default' : 'outline'} size="sm" onClick={() => onAttendanceChange(student.student_id, 'present')} className="gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {t('attendance.status.present')}
                      </Button>
                      <Button variant={student.status === 'absent' ? 'destructive' : 'outline'} size="sm" onClick={() => onAttendanceChange(student.student_id, 'absent')} className="gap-1">
                        <XCircle className="w-3 h-3" />
                        {t('attendance.status.absent')}
                      </Button>
                      <Button variant={student.status === 'late' ? 'default' : 'outline'} size="sm" onClick={() => onAttendanceChange(student.student_id, 'late')} className="gap-1">
                        <Clock className="w-3 h-3" />
                        {t('attendance.status.late')}
                      </Button>
                      <Button variant={student.status === 'excused' ? 'secondary' : 'outline'} size="sm" onClick={() => onAttendanceChange(student.student_id, 'excused')} className="gap-1">
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
  );
}
