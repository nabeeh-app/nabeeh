'use client';

import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface AttendanceStats {
  total_sessions: number;
  attendance_rate: number;
  present_count: number;
  absent_count: number;
  late_count: number;
  excused_count: number;
}

interface AttendanceStatsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: AttendanceStats | null;
}

export default function AttendanceStatsModal({
  open,
  onOpenChange,
  stats,
}: AttendanceStatsModalProps) {
  const t = useTranslations();

  if (!stats) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('attendance.statsTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-surface-sage rounded-lg">
              <div className="text-2xl font-bold text-ink">{stats.total_sessions}</div>
              <div className="text-sm text-ink/60">{t('attendance.totalSessions')}</div>
            </div>
            <div className="text-center p-4 bg-surface-sage rounded-lg">
              <div className="text-2xl font-bold text-primary">{stats.attendance_rate}%</div>
              <div className="text-sm text-ink/60">{t('attendance.attendanceRate')}</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                {t('attendance.status.present')}
              </span>
              <span className="font-medium">{stats.present_count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-destructive" />
                {t('attendance.status.absent')}
              </span>
              <span className="font-medium">{stats.absent_count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-ink/70" />
                {t('attendance.status.late')}
              </span>
              <span className="font-medium">{stats.late_count}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary" />
                {t('attendance.status.excused')}
              </span>
              <span className="font-medium">{stats.excused_count}</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
