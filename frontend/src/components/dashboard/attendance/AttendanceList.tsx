'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Calendar } from 'lucide-react';
import { Attendance } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, formatDateTime } from '@/lib/utils';

interface AttendanceListProps {
  records: Attendance[];
  statusFilter: string;
  studentFilter: string;
  onStatusFilterChange: (value: string) => void;
  onStudentFilterChange: (value: string) => void;
  getStatusBadge: (status: string) => { variant: 'default' | 'destructive' | 'outline' | 'secondary'; label: string; color: string };
}

export default function AttendanceList({
  records,
  statusFilter,
  studentFilter,
  onStatusFilterChange,
  onStudentFilterChange,
  getStatusBadge,
}: AttendanceListProps) {
  const t = useTranslations();
  const locale = useLocale();

  if (records.length === 0) {
    return (
      <EmptyState icon={Calendar} message={t('attendance.noRecords')} />
    );
  }

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-ink font-display">{t('attendance.attendanceRecords')}</h2>
        <div className="flex items-center gap-2">
          <Input placeholder={t('attendance.searchStudent')} value={studentFilter} onChange={(e) => onStudentFilterChange(e.target.value)} className="w-64" />
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
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
          {records.map((record: Attendance) => {
            const status = getStatusBadge(record.status);
            return (
              <TableRow key={record.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
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
                  {formatDate(record.date, locale)}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant} className={status.color}>{status.label}</Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-ink/60">{record.notes || '-'}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-ink/60">
                    {formatDateTime(record.created_at, locale)}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
