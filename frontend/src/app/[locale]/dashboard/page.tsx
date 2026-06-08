'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth, usePermissions } from '@/hooks/useAuth';
import { apiClient } from '@/lib/api';
import { DashboardStats } from '@/types';
import { useParams } from 'next/navigation';

export default function DashboardPage() {
  const { teacher } = useAuth();
  const { isTeacher, isAdmin, isParent } = usePermissions();
  const params = useParams();
  const locale = params.locale as 'ar' | 'en';
  const isRTL = locale === 'ar';
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  const t = {
    en: {
      welcome: 'Welcome back',
      dashboard: 'Dashboard',
      overview: 'Overview',
      students: 'Students',
      attendance: 'Attendance',
      grades: 'Grades',
      messages: 'Messages',
      settings: 'Settings',
      adminPanel: 'Admin Panel',
      userManagement: 'User Management',
      systemSettings: 'System Settings',
      auditLogs: 'Audit Logs',
      responseRate: 'Response Rate',
      totalParents: 'Total Parents',
      activeStudents: 'Active Students',
      statsUnavailable: 'Stats are temporarily unavailable.'
    },
    ar: {
      welcome: 'مرحباً بعودتك',
      dashboard: 'لوحة التحكم',
      overview: 'نظرة عامة',
      students: 'الطلاب',
      attendance: 'الحضور',
      grades: 'الدرجات',
      messages: 'الرسائل',
      settings: 'الإعدادات',
      adminPanel: 'لوحة الإدارة',
      userManagement: 'إدارة المستخدمين',
      systemSettings: 'إعدادات النظام',
      auditLogs: 'سجلات التدقيق',
      responseRate: 'معدل الاستجابة',
      totalParents: 'إجمالي أولياء الأمور',
      activeStudents: 'الطلاب النشطون',
      statsUnavailable: 'الإحصاءات غير متاحة مؤقتاً.'
    }
  };

  const text = t[locale];
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
    <div className={`min-h-screen bg-gray-50 ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Header */}
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {text.dashboard}
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  {text.welcome}, {teacher?.name}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${teacher?.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                  teacher?.role === 'teacher' ? 'bg-blue-100 text-blue-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                  {teacher?.role}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">

            {/* Quick Stats */}
            {statsError && (
              <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {text.statsUnavailable}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {isTeacher() && (
                <>
                  <StatCard
                    title={text.students}
                    value={isStatsReady ? formatNumber(totalStudents) : '—'}
                    icon="👥"
                  />
                  <StatCard
                    title={text.attendance}
                    value={isStatsReady ? `${attendanceRate}%` : '—'}
                    icon="📊"
                  />
                  <StatCard
                    title={text.grades}
                    value={isStatsReady ? formatNumber(totalGrades) : '—'}
                    icon="📝"
                  />
                  <StatCard
                    title={text.messages}
                    value={isStatsReady ? formatNumber(messageConversations) : '—'}
                    icon="💬"
                  />
                </>
              )}

              {isAdmin() && (
                <>
                  <StatCard
                    title={text.students}
                    value={isStatsReady ? formatNumber(totalStudents) : '—'}
                    icon="🎓"
                  />
                  <StatCard
                    title={text.activeStudents}
                    value={isStatsReady ? formatNumber(activeStudents) : '—'}
                    icon="👤"
                  />
                  <StatCard
                    title={text.totalParents}
                    value={isStatsReady ? formatNumber(totalParents) : '—'}
                    icon="👨‍👩‍👧"
                  />
                  <StatCard
                    title={text.responseRate}
                    value={isStatsReady ? `${Math.round(responseRate)}%` : '—'}
                    icon="⚡"
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
                    title={text.students}
                    description="Manage your students and their information"
                    icon="👥"
                    href={`/${locale}/dashboard/students`}
                  />
                  <NavigationCard
                    title={text.attendance}
                    description="Track and manage student attendance"
                    icon="📊"
                    href={`/${locale}/dashboard/attendance`}
                  />
                  <NavigationCard
                    title={text.grades}
                    description="Record and manage student grades"
                    icon="📝"
                    href={`/${locale}/dashboard/grades`}
                  />
                  <NavigationCard
                    title={text.messages}
                    description="Communicate with parents via WhatsApp"
                    icon="💬"
                    href={`/${locale}/dashboard/messages`}
                  />
                </>
              )}

              {/* Admin Features */}
              {isAdmin() && (
                <>
                  <NavigationCard
                    title={text.userManagement}
                    description="Manage teachers, students, and parents"
                    icon="👤"
                    href={`/${locale}/dashboard/admin/users`}
                  />
                  <NavigationCard
                    title={text.systemSettings}
                    description="Configure system settings and preferences"
                    icon="⚙️"
                    href={`/${locale}/dashboard/admin/settings`}
                  />
                  <NavigationCard
                    title={text.auditLogs}
                    description="View system audit logs and security events"
                    icon="📋"
                    href={`/${locale}/dashboard/admin/audit`}
                  />
                </>
              )}

              {/* Common Features */}
              <NavigationCard
                title={text.settings}
                description="Manage your account settings and preferences"
                icon="⚙️"
                href={`/${locale}/dashboard/settings`}
              />
            </div>
          </div>
        </main>
      </div>
  );
}

// Stat Card Component
function StatCard({ title, value, icon }: { title: string; value: string; icon: string }) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg">
      <div className="p-5">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="text-2xl">{icon}</span>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dl>
              <dt className="text-sm font-medium text-gray-500 truncate">
                {title}
              </dt>
              <dd className="text-lg font-medium text-gray-900">
                {value}
              </dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

// Navigation Card Component
function NavigationCard({
  title,
  description,
  icon,
  href
}: {
  title: string;
  description: string;
  icon: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200"
    >
      <div className="p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <span className="text-3xl">{icon}</span>
          </div>
          <div className="ml-4">
            <h3 className="text-lg font-medium text-gray-900">
              {title}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {description}
            </p>
          </div>
        </div>
      </div>
    </a>
  );
}
