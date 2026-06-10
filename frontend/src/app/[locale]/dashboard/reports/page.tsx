'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useState, useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import logger from '@/lib/logger';
import {
  BarChart3,
  Users,
  GraduationCap,
  MessageSquare,
  Calendar,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { apiClient } from '@/lib/client';
import { GradeStats, AttendanceSummary, MessageStats } from '@/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { StatCards } from '@/components/ui/StatCards';

export default function ReportsPage() {
  const t = useTranslations();
  const tReportsStatus = useTranslations('reportsStatus');
  const locale = useLocale();

  const [gradeStats, setGradeStats] = useState<GradeStats | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [messageStats, setMessageStats] = useState<MessageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('lastMonth');

  useEffect(() => {
    loadStats();
  }, [dateRange]);

  const getDateParams = () => {
    const now = new Date();
    const start = new Date();
    switch (dateRange) {
      case 'lastWeek':
        start.setDate(now.getDate() - 7);
        break;
      case 'lastMonth':
        start.setMonth(now.getMonth() - 1);
        break;
      case 'lastSemester':
        start.setMonth(now.getMonth() - 6);
        break;
      default:
        start.setMonth(now.getMonth() - 1);
    }
    return {
      start_date: start.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
    };
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      const params = getDateParams();

      const [grades, attendance, messages] = await Promise.allSettled([
        apiClient.getGradeStats(),
        apiClient.getAttendanceSummary(params),
        apiClient.getMessageStats(),
      ]);

      if (grades.status === 'fulfilled') setGradeStats(grades.value);
      if (attendance.status === 'fulfilled') setAttendanceSummary(attendance.value);
      if (messages.status === 'fulfilled') setMessageStats(messages.value);
    } catch (err) {
      logger.error('Failed to load report stats', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message={t('reports.loading')} />;
  }

  const stats = [
    {
      icon: Users,
      value: attendanceSummary?.total_sessions ?? '—',
      label: t('reports.totalStudents'),
      color: 'primary' as const,
    },
    {
      icon: Calendar,
      value: attendanceSummary ? `${Math.round(attendanceSummary.attendance_rate)}%` : '—',
      label: t('reports.attendanceRate'),
      color: 'success' as const,
    },
    {
      icon: GraduationCap,
      value: gradeStats ? `${Math.round(gradeStats.average_score)}%` : '—',
      label: t('reports.averageScore'),
      color: 'accent' as const,
    },
    {
      icon: MessageSquare,
      value: messageStats?.total_messages ?? '—',
      label: t('reports.totalMessages'),
      color: 'warning' as const,
    },
  ];

  const topSubjects = gradeStats?.by_subject
    ? Object.entries(gradeStats.by_subject)
        .sort(([, a], [, b]) => b.average - a.average)
        .slice(0, 5)
    : [];

  const assessmentTypes = gradeStats?.by_assessment_type
    ? Object.entries(gradeStats.by_assessment_type)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('reports.title')}
        description={t('reports.description')}
      >
        <Select value={dateRange} onValueChange={setDateRange}>
          <SelectTrigger className="min-w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lastWeek">{t('reports.lastWeek')}</SelectItem>
            <SelectItem value="lastMonth">{t('reports.lastMonth')}</SelectItem>
            <SelectItem value="lastSemester">{t('reports.lastSemester')}</SelectItem>
          </SelectContent>
        </Select>
      </PageHeader>

      <StatCards stats={stats} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade Performance by Subject */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-display">
              <GraduationCap className="h-5 w-5 text-primary" />
              {t('reports.topSubjects')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topSubjects.length === 0 ? (
              <p className="text-ink/60 text-center py-4 font-body">{t('reports.noData')}</p>
            ) : (
              <div className="space-y-3">
                {topSubjects.map(([subject, data]) => (
                  <div key={subject} className="flex items-center justify-between">
                    <span className="font-medium text-sm">{subject}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-surface-cool rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(data.average, 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-ink/60 w-12 text-right">
                        {Math.round(data.average)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assessment Types */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-display">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t('grades.assessmentTypes.quiz')} / {t('grades.assessmentTypes.exam')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assessmentTypes.length === 0 ? (
              <p className="text-ink/60 text-center py-4 font-body">{t('reports.noData')}</p>
            ) : (
              <div className="space-y-3">
                {assessmentTypes.map(([type, data]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="font-medium text-sm capitalize">{type}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-ink/60">
                        {data.count} {tReportsStatus('assessments')}
                      </span>
                      <div className="flex items-center gap-1">
                        {data.average >= 70 ? (
                          <TrendingUp className="h-3 w-3 text-success" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-error" />
                        )}
                        <span className="text-sm font-medium">
                          {Math.round(data.average)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-display">
              <Calendar className="h-5 w-5 text-primary" />
              {t('attendance.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!attendanceSummary ? (
              <p className="text-ink/60 text-center py-4 font-body">{t('reports.noData')}</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-sage p-3 rounded-md text-center">
                    <div className="text-2xl font-bold text-ink font-display">
                      {attendanceSummary.present_count}
                    </div>
                    <div className="text-xs text-ink/60 font-mono uppercase tracking-wider">
                      {t('attendance.summary.present')}
                    </div>
                  </div>
                  <div className="bg-surface-cool p-3 rounded-md text-center">
                    <div className="text-2xl font-bold text-ink font-display">
                      {attendanceSummary.absent_count}
                    </div>
                    <div className="text-xs text-ink/60 font-mono uppercase tracking-wider">
                      {t('attendance.summary.absent')}
                    </div>
                  </div>
                  <div className="bg-surface-cool p-3 rounded-md text-center">
                    <div className="text-2xl font-bold text-ink font-display">
                      {attendanceSummary.late_count}
                    </div>
                    <div className="text-xs text-ink/60 font-mono uppercase tracking-wider">
                      {t('attendance.summary.late')}
                    </div>
                  </div>
                  <div className="bg-surface-cool p-3 rounded-md text-center">
                    <div className="text-2xl font-bold text-ink font-display">
                      {attendanceSummary.excused_count}
                    </div>
                    <div className="text-xs text-ink/60 font-mono uppercase tracking-wider">
                      {t('attendance.summary.excused')}
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary font-display">
                    {Math.round(attendanceSummary.attendance_rate)}%
                  </div>
                  <div className="text-sm text-ink/60">{t('attendance.summary.percentage')}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Message Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-display">
              <MessageSquare className="h-5 w-5 text-primary" />
              {t('messages.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!messageStats ? (
              <p className="text-ink/60 text-center py-4 font-body">{t('reports.noData')}</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-sage p-3 rounded-md text-center">
                    <div className="text-2xl font-bold text-ink font-display">
                      {messageStats.total_messages}
                    </div>
                    <div className="text-xs text-ink/60 font-mono uppercase tracking-wider">
                      {tReportsStatus('total')}
                    </div>
                  </div>
                  <div className="bg-surface-cool p-3 rounded-md text-center">
                    <div className="text-2xl font-bold text-ink font-display">
                      {messageStats.incoming_messages}
                    </div>
                    <div className="text-xs text-ink/60 font-mono uppercase tracking-wider">
                      {t('messages.received')}
                    </div>
                  </div>
                  <div className="bg-surface-cool p-3 rounded-md text-center">
                    <div className="text-2xl font-bold text-ink font-display">
                      {messageStats.outgoing_messages}
                    </div>
                    <div className="text-xs text-ink/60 font-mono uppercase tracking-wider">
                      {t('messages.sent')}
                    </div>
                  </div>
                  <div className="bg-surface-cool p-3 rounded-md text-center">
                    <div className="text-2xl font-bold text-ink font-display">
                      {messageStats.automated_messages}
                    </div>
                    <div className="text-xs text-ink/60 font-mono uppercase tracking-wider">
                      {tReportsStatus('automated')}
                    </div>
                  </div>
                </div>
                {Object.keys(messageStats.common_intents).length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-ink/70 mb-2">
                      {tReportsStatus('commonIntents')}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(messageStats.common_intents)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([intent, count]) => (
                          <span
                            key={intent}
                            className="px-2 py-1 bg-surface-cool rounded text-xs font-mono"
                          >
                            {intent} ({count})
                          </span>
                        ))}
                    </div>
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
