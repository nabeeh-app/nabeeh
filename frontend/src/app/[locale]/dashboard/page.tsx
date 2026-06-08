'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth, usePermissions } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';
import { DashboardStats } from '@/types';
import { Users, BarChart3, FileText, MessageSquare, GraduationCap, User, Users2, Zap, BookOpen, ClipboardList, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export default function DashboardPage() {
  const { teacher } = useAuth();
  const { isTeacher, isAdmin } = usePermissions();
  const locale = useLocale();
  const t = useTranslations('dashboard');
  const tNav = useTranslations('navigation');
  const tStudents = useTranslations('students');
  const tAttendance = useTranslations('attendance');
  const tGrades = useTranslations('grades');
  const tMessages = useTranslations('messages');
  const tSettings = useTranslations('settings');

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const formatNumber = (value: number) => new Intl.NumberFormat(locale).format(value);

  useEffect(() => {
    if (!teacher) {
      return;
    }

    let isMounted = true;
    const loadStats = async () => {
      setStatsLoading(true);
      setStatsError(null);
      try {
        const data = await apiClient.getDashboardStats();
        if (isMounted) {
          setStats(data);
        }
      } catch {
        if (isMounted) {
          setStatsError('unavailable');
        }
      } finally {
        if (isMounted) {
          setStatsLoading(false);
        }
      }
    };

    loadStats();
    return () => {
      isMounted = false;
    };
  }, [teacher]);

  const attendanceRate = useMemo(() => {
    if (!stats?.recent_attendance?.length) {
      return 0;
    }

    const latest = stats.recent_attendance.reduce((currentLatest, entry) => {
      if (!currentLatest) {
        return entry;
      }
      return new Date(entry.date) > new Date(currentLatest.date) ? entry : currentLatest;
    }, stats.recent_attendance[0]);

    if (!latest.total) {
      return 0;
    }

    return Math.round((latest.present / latest.total) * 100);
  }, [stats]);

  const totalGrades = useMemo(() => {
    if (!stats?.recent_grades?.length) {
      return 0;
    }
    return stats.recent_grades.reduce((sum, entry) => sum + entry.count, 0);
  }, [stats]);

  const totalStudents = stats?.total_students ?? 0;
  const activeStudents = stats?.active_students ?? 0;
  const totalParents = stats?.total_parents ?? 0;
  const messageConversations = stats?.message_stats?.total_conversations ?? 0;
  const responseRate = stats?.message_stats?.response_rate ?? 0;
  const isStatsReady = !statsLoading && !statsError;

  return (
    <div className="space-y-6">
        {/* Header */}
        <header>
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {t('title')}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('welcome')}, {teacher?.name}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${teacher?.role === 'admin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                teacher?.role === 'teacher' ? 'bg-primary/10 text-primary' :
                  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                }`}>
                {teacher?.role}
              </span>
            </div>
          </div>
        </header>

        {/* Quick Stats */}
        {statsError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            {t('statsUnavailable')}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {isTeacher() && (
            <>
              <StatCard
                title={tStudents('totalStudents')}
                value={isStatsReady ? formatNumber(totalStudents) : '—'}
                icon={Users}
              />
              <StatCard
                title={tAttendance('attendanceRate')}
                value={isStatsReady ? `${attendanceRate}%` : '—'}
                icon={BarChart3}
              />
              <StatCard
                title={tGrades('totalGrades')}
                value={isStatsReady ? formatNumber(totalGrades) : '—'}
                icon={FileText}
              />
              <StatCard
                title={tMessages('title')}
                value={isStatsReady ? formatNumber(messageConversations) : '—'}
                icon={MessageSquare}
              />
            </>
          )}

          {isAdmin() && (
            <>
              <StatCard
                title={tStudents('totalStudents')}
                value={isStatsReady ? formatNumber(totalStudents) : '—'}
                icon={GraduationCap}
              />
              <StatCard
                title={tStudents('activeStudents')}
                value={isStatsReady ? formatNumber(activeStudents) : '—'}
                icon={User}
              />
              <StatCard
                title={t('totalParents')}
                value={isStatsReady ? formatNumber(totalParents) : '—'}
                icon={Users2}
              />
              <StatCard
                title={t('responseRate')}
                value={isStatsReady ? `${Math.round(responseRate)}%` : '—'}
                icon={Zap}
              />
            </>
          )}
        </div>

        {/* Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {/* Teacher Features */}
          {isTeacher() && (
            <>
              <NavigationCard
                title={tStudents('title')}
                description={tStudents('manageDescription')}
                icon={Users}
                href={`/${locale}/dashboard/students`}
              />
              <NavigationCard
                title={tAttendance('title')}
                description={tAttendance('description')}
                icon={BarChart3}
                href={`/${locale}/dashboard/attendance`}
              />
              <NavigationCard
                title={tGrades('title')}
                description={tGrades('descriptionCount')}
                icon={FileText}
                href={`/${locale}/dashboard/grades`}
              />
              <NavigationCard
                title={tMessages('title')}
                description={tMessages('sendViaWhatsApp')}
                icon={MessageSquare}
                href={`/${locale}/dashboard/messages`}
              />
            </>
          )}

          {/* Admin Features */}
          {isAdmin() && (
            <>
              <NavigationCard
                title={tNav('students')}
                description={tStudents('manageDescription')}
                icon={User}
                href={`/${locale}/dashboard/admin/users`}
              />
              <NavigationCard
                title={tSettings('title')}
                description={tSettings('preferences')}
                icon={Settings}
                href={`/${locale}/dashboard/admin/settings`}
              />
              <NavigationCard
                title={t('auditLogs')}
                description={t('auditLogs')}
                icon={ClipboardList}
                href={`/${locale}/dashboard/admin/audit`}
              />
            </>
          )}

          {/* Common Features */}
          <NavigationCard
            title={tSettings('title')}
            description={tSettings('preferences')}
            icon={Settings}
            href={`/${locale}/dashboard/settings`}
          />
        </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: LucideIcon }) {
  const Icon = icon;
  return (
    <div className="bg-card overflow-hidden shadow rounded-lg border border-border">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          <div className="ms-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-muted-foreground truncate">
                {title}
              </dt>
              <dd className="text-lg font-medium text-foreground">
                {value}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function NavigationCard({
  title,
  description,
  icon,
  href
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}) {
  const Icon = icon;
  return (
    <a
      href={href}
      className="bg-card overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200 border border-border"
    >
      <div className="p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <div className="ms-4">
            <h3 className="text-lg font-medium text-foreground">
              {title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {description}
            </p>
          </div>
        </div>
      </div>
    </a>
  );
}
