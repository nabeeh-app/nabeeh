'use client';

import { useTranslations, useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  MessageSquare,
  Settings,
  BarChart3,
  LogOut,
  Home,
  Activity,
  Smartphone,
  type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useAuth } from '@/hooks/useAuth';
import { isFeatureEnabled, type FeatureKey } from '@/config/featureFlags';

type NavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  featureKey?: FeatureKey;
};

const navigation: NavigationItem[] = [
  {
    name: 'dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    name: 'students',
    href: '/dashboard/students',
    icon: Users,
  },
  {
    name: 'attendance',
    href: '/dashboard/attendance',
    icon: Calendar,
  },
  {
    name: 'grades',
    href: '/dashboard/grades',
    icon: GraduationCap,
    featureKey: 'grades',
  },
  {
    name: 'courses',
    href: '/dashboard/courses',
    icon: BookOpen,
    featureKey: 'courses',
  },
  {
    name: 'classes',
    href: '/dashboard/classes',
    icon: GraduationCap,
  },
  {
    name: 'schedule',
    href: '/dashboard/schedule',
    icon: Calendar,
  },
  {
    name: 'messages',
    href: '/dashboard/messages',
    icon: MessageSquare,
    featureKey: 'messaging',
  },
  {
    name: 'whatsapp',
    href: '/dashboard/whatsapp',
    icon: Smartphone,
  },
  {
    name: 'reports',
    href: '/dashboard/reports',
    icon: BarChart3,
    featureKey: 'reports',
  },
  {
    name: 'monitor',
    href: '/dashboard/monitor',
    icon: Activity,
    featureKey: 'monitor',
  },
  {
    name: 'settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

export function Sidebar() {
  const t = useTranslations('navigation');
  const locale = useLocale();
  const pathname = usePathname();
  const { logout, teacher } = useAuth();

  const getTeacherInitials = (name: string) => {
    const words = name.split(' ');
    if (words.length >= 2) {
      return words[0].charAt(0) + words[1].charAt(0);
    }
    return words[0].charAt(0) + words[0].charAt(1);
  };

  return (
    <div className="flex h-full w-64 flex-col bg-white border-r border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {locale === 'ar' ? 'نبيه' : 'Nabeeh'}
          </h1>
        </div>
        <LanguageSwitcher />
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation
          .filter((item) => !item.featureKey || isFeatureEnabled(item.featureKey))
          .map((item) => {
          const Icon = item.icon;
          const isActive = pathname === `/${locale}${item.href}`;
          
          return (
            <Link
              key={item.name}
              href={`/${locale}${item.href}`}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{t(item.name)}</span>
            </Link>
          );
        })}
        {teacher?.role === 'admin' && (
          <Link
            href={`/${locale}/dashboard/admin/teachers`}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === `/${locale}/dashboard/admin/teachers`
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>{locale === 'ar' ? 'إدارة المعلمين' : 'Manage Teachers'}</span>
          </Link>
        )}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <Avatar>
            <AvatarFallback className="bg-blue-100 text-blue-700">
              {teacher?.name ? getTeacherInitials(teacher.name) : 'T'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {teacher?.name || (locale === 'ar' ? 'المعلم' : 'Teacher')}
            </p>
            <p className="text-xs text-gray-500 truncate">
              {teacher?.business_name || teacher?.email || (locale === 'ar' ? 'مدرس' : 'Educator')}
            </p>
          </div>
        </div>
        
        <Button
          onClick={logout}
          variant="outline"
          size="sm"
          className="w-full gap-2"
        >
          <LogOut className="w-4 h-4" />
          {locale === 'ar' ? 'تسجيل الخروج' : 'Logout'}
        </Button>
      </div>
    </div>
  );
}
