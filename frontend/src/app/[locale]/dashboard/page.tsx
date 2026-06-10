'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useAuth, usePermissions } from '@/hooks/useAuth';
import { apiClient } from '@/lib/client';
import { DashboardStats } from '@/types';
import { Users, BarChart3, FileText, MessageSquare, GraduationCap, User, Users2, Zap, ClipboardList, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getVisibleNavigation } from '@/config/navigation';

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
  const tCourses = useTranslations('courses');
  const tReports = useTranslations('reports');
  const tMonitor = useTranslations('monitor');
  const tRoles = useTranslations('roles');

  const navItems = useMemo(() => getVisibleNavigation(teacher?.role), [teacher?.role]);

  /** Resolve a description from a nav item's descriptionKey + descriptionNs. */
  const getDescription = (item: (typeof navItems)[number]): string | null => {
    if (!item.descriptionKey || !item.descriptionNs) return null;
    const map: Record<string, ReturnType<typeof useTranslations>> = {
      students: tStudents,
      attendance: tAttendance,
      grades: tGrades,
      messages: tMessages,
      settings: tSettings,
      courses: tCourses,
      reports: tReports,
      monitor: tMonitor,
    };
    const ns = map[item.descriptionNs];
    return ns ? ns(item.descriptionKey) : null;
  };

  /** Items that have a description are shown as NavigationCards. */
  const cardItems = navItems.filter((item) => getDescription(item));

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
          <div className="py-6">
            <h1 className="text-4xl font-bold text-ink font-display">
              {t('title')}
            </h1>
            <p className="mt-2 text-lg text-ink/60 font-body uppercase tracking-wider">
              {t('welcome')}, {teacher?.name}{' '}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-pill text-xs font-medium font-mono uppercase tracking-wider ${teacher?.role === 'admin' ? 'bg-surface-sage text-ink' :
                teacher?.role === 'teacher' ? 'bg-primary/10 text-primary' :
                  'bg-accent text-ink'
                }`}>
                {teacher?.role === 'admin' ? tRoles('admin') : teacher?.role === 'teacher' ? tRoles('teacher') : teacher?.role}
              </span>
            </p>
          </div>
        </header>

        {/* Quick Stats */}
        {statsError && (
          <div className="rounded-md bg-surface-sage px-4 py-3 text-base text-ink font-body">
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
          {cardItems.map((item) => {
            const Icon = item.icon;
            const description = getDescription(item);
            return (
              <NavigationCard
                key={item.name}
                title={tNav(item.name)}
                description={description!}
                icon={Icon}
                href={`/${locale}${item.href}`}
              />
            );
          })}

          {/* Admin-only cards (not in shared nav config) */}
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
        </div>
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: LucideIcon }) {
  const Icon = icon;
  return (
    <div className="bg-surface-sage p-5 rounded-md">
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink/50 truncate font-body uppercase tracking-wider">
            {title}
          </p>
          <p className="text-3xl font-bold text-ink font-display leading-tight">
            {value}
          </p>
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
      className="block bg-canvas rounded-md shadow-[0_1px_3px_rgba(8,61,68,0.06)] hover:shadow-[0_2px_8px_rgba(8,61,68,0.1)] transition-shadow duration-200"
    >
      <div className="p-6">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-ink font-display">
              {title}
            </h3>
            <p className="mt-0.5 text-base text-ink/50 font-body">
              {description}
            </p>
          </div>
        </div>
      </div>
    </a>
  );
}
