'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { LogOut, Menu, X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useAuth } from '@/hooks/useAuth';
import { getVisibleNavigation } from '@/config/navigation';

const UNLOCK_KEYS = {
  attendance: 'nabeeh_has_students',
  grades: 'nabeeh_has_attendance',
  reports: 'nabeeh_has_grades',
} as const;

type UnlockFeature = keyof typeof UNLOCK_KEYS;

function isFeatureUnlocked(feature: UnlockFeature): boolean {
  if (typeof window === 'undefined') return false;
  const key = UNLOCK_KEYS[feature];
  return localStorage.getItem(key) === 'true';
}

export function Sidebar() {
  const t = useTranslations('navigation');
  const tCommon = useTranslations('common');
  const tRoles = useTranslations('roles');
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

  const navItems = useMemo(() => getVisibleNavigation(teacher?.role), [teacher?.role]);

  const sidebarContent = (
    <div className="flex h-full w-64 flex-col bg-sidebar border-s border-sidebar-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 flex items-center justify-center overflow-hidden">
            <svg viewBox="0 0 200 240" fill="none" className="w-10 h-12">
              <defs>
                <linearGradient id="sidebarBodyGrad" x1="100" y1="40" x2="100" y2="200" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#05c4b8"/>
                  <stop offset="1" stopColor="#026370"/>
                </linearGradient>
              </defs>
              <path d="M93 44Q85 15 68 12Q82 20 90 40" fill="#05c4b8"/>
              <path d="M100 40Q108 8 128 8Q112 16 105 38" fill="#05c4b8"/>
              <ellipse cx="100" cy="112" rx="74" ry="82" fill="url(#sidebarBodyGrad)"/>
              <ellipse cx="100" cy="108" rx="60" ry="68" fill="#05c4b8" opacity="0.25"/>
              <rect x="78" y="184" width="44" height="10" rx="4" fill="#026370"/>
              <rect x="82" y="196" width="36" height="8" rx="3" fill="#083d44"/>
              <rect x="86" y="206" width="28" height="6" rx="3" fill="#083d44"/>
              <circle cx="70" cy="110" r="32" stroke="white" strokeWidth="6" fill="none"/>
              <circle cx="130" cy="110" r="32" stroke="white" strokeWidth="6" fill="none"/>
              <path d="M102 102Q100 94 98 102" stroke="white" strokeWidth="5" fill="none"/>
              <path d="M38 104Q24 100 16 104" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none"/>
              <path d="M162 104Q176 100 184 104" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none"/>
              <ellipse cx="70" cy="112" rx="11" ry="12" fill="#083d44"/>
              <circle cx="66" cy="108" r="4" fill="white"/>
              <ellipse cx="130" cy="112" rx="11" ry="12" fill="#083d44"/>
              <circle cx="126" cy="108" r="4" fill="white"/>
              <path d="M86 142Q100 154 114 142" stroke="#083d44" strokeWidth="3.5" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
          <h1 className="text-lg font-bold text-sidebar-foreground font-display">
            {tCommon('dashboard')}
          </h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.href === '/dashboard'
            ? pathname === '/dashboard' || pathname.endsWith('/dashboard')
            : pathname.includes(item.href);

          if (item.disabled) {
            return (
              <span
                key={item.name}
                className="flex items-center gap-3 px-3 py-3 mx-1 rounded-md text-base font-normal font-body uppercase tracking-wider text-sidebar-accent-foreground/40 cursor-not-allowed select-none"
                title={t(item.name)}
              >
                <Icon className="w-4.5 h-4.5" />
                <span>{t(item.name)}</span>
              </span>
            );
          }

          const unlockFeature = item.unlockFeature as UnlockFeature | undefined;
          const isLocked = unlockFeature && !isFeatureUnlocked(unlockFeature);

          if (isLocked) {
            return (
              <button
                key={item.name}
                onClick={() => alert('Upgrade to unlock this feature')}
                className="flex items-center gap-3 px-3 py-3 mx-1 rounded-md text-base font-normal font-body uppercase tracking-wider text-sidebar-accent-foreground/40 opacity-50 cursor-pointer transition-colors hover:bg-sidebar-accent/30"
                title="Upgrade to unlock this feature"
              >
                <Icon className="w-4.5 h-4.5" />
                <span>{t(item.name)}</span>
                <Lock className="w-3.5 h-3.5 ml-auto opacity-60" />
              </button>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 mx-1 rounded-md text-base font-normal transition-colors font-body uppercase tracking-wider ${
                isActive
                  ? 'bg-sidebar-primary/20 text-sidebar-primary'
                  : 'text-sidebar-accent-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
              <span>{t(item.name)}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-sidebar-primary/10 text-sidebar-primary text-xs rounded-md">
              {teacher?.name ? getTeacherInitials(teacher.name) : 'T'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-sidebar-foreground truncate font-body">
              {teacher?.name || ''}
            </p>
            <p className="text-xs text-sidebar-primary truncate font-body">
              {teacher?.role === 'admin' ? tRoles('admin') : teacher?.role === 'teacher' ? tRoles('teacher') : teacher?.role || ''}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <LanguageSwitcher className="flex-1 justify-start text-sidebar-accent-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent" />
          <Button
            onClick={logout}
            variant="ghost"
            size="sm"
            className="gap-2 text-sidebar-accent-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            aria-label={tCommon('logout')}
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="fixed top-4 left-4 z-50 md:hidden p-3 rounded-none bg-sidebar text-sidebar-foreground"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
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
