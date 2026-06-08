'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
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
  Menu,
  X,
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
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const { logout, teacher } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const getTeacherInitials = (name: string) => {
    const words = name.split(' ');
    if (words.length >= 2) {
      return words[0].charAt(0) + words[1].charAt(0);
    }
    return words[0].charAt(0) + words[0].charAt(1);
  };

  const sidebarContent = (
    <div className="flex h-full w-64 flex-col bg-sidebar border-s border-sidebar-border">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-sidebar-foreground">
            {tCommon('dashboard')}
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
          const isActive = pathname.includes(item.href);
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-primary'
                  : 'text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{t(item.name)}</span>
            </Link>
          );
        })}
        {teacher?.role === 'admin' && (
          <Link
            href="/dashboard/admin/teachers"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname.includes('/dashboard/admin/teachers')
                ? 'bg-sidebar-accent text-sidebar-primary'
                : 'text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground'
            }`}
          >
            <Users className="w-5 h-5" />
            <span>{t('settings')}</span>
          </Link>
        )}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-4">
          <Avatar>
            <AvatarFallback className="bg-sidebar-primary/10 text-sidebar-primary">
              {teacher?.name ? getTeacherInitials(teacher.name) : 'T'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">
              {teacher?.name || t('settings')}
            </p>
            <p className="text-xs text-sidebar-accent-foreground truncate">
              {teacher?.business_name || teacher?.email || ''}
            </p>
          </div>
        </div>
        
        <Button
          onClick={logout}
          variant="outline"
          size="sm"
          className="w-full gap-2"
          aria-label={tCommon('logout')}
        >
          <LogOut className="w-4 h-4" />
          {tCommon('logout')}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-lg bg-sidebar text-sidebar-foreground shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full">
        {sidebarContent}
      </div>

      {/* Mobile sidebar */}
      <div className={`fixed inset-y-0 left-0 z-40 md:hidden transform transition-transform duration-200 ease-in-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {sidebarContent}
      </div>
    </>
  );
}
