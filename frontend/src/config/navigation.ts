import {
  Home,
  Users,
  Calendar,
  GraduationCap,
  BookOpen,
  MessageSquare,
  Smartphone,
  BarChart3,
  Activity,
  Settings,
  UserPlus,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { isFeatureEnabled, type FeatureKey } from '@/config/featureFlags';

export type NavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  featureKey?: FeatureKey;
  /** If set, only these roles see the item. Omit = all roles. */
  roles?: ('teacher' | 'admin')[];
  /** If true, item renders as disabled (non-clickable). */
  disabled?: boolean;
  /** Progressive unlock key — item is locked until the corresponding localStorage flag is set. */
  unlockFeature?: 'attendance' | 'grades' | 'reports';
  /** Translation key for a short description (used by dashboard cards). */
  descriptionKey?: string;
  /** Translation namespace for the description. */
  descriptionNs?: string;
};

export const navigationItems: NavigationItem[] = [
  {
    name: 'dashboard',
    href: '/dashboard',
    icon: Home,
  },
  {
    name: 'students',
    href: '/dashboard/students',
    icon: Users,
    descriptionKey: 'manageDescription',
    descriptionNs: 'students',
  },
  {
    name: 'attendance',
    href: '/dashboard/attendance',
    icon: Calendar,
    unlockFeature: 'attendance',
    descriptionKey: 'description',
    descriptionNs: 'attendance',
  },
  {
    name: 'grades',
    href: '/dashboard/grades',
    icon: GraduationCap,
    featureKey: 'grades',
    unlockFeature: 'grades',
    descriptionKey: 'descriptionCount',
    descriptionNs: 'grades',
  },
  {
    name: 'courses',
    href: '/dashboard/courses',
    icon: BookOpen,
    featureKey: 'courses',
    descriptionKey: 'description',
    descriptionNs: 'courses',
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
    disabled: true,
  },
  {
    name: 'messages',
    href: '/dashboard/messages',
    icon: MessageSquare,
    featureKey: 'messaging',
    descriptionKey: 'sendViaWhatsApp',
    descriptionNs: 'messages',
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
    unlockFeature: 'reports',
    descriptionKey: 'description',
    descriptionNs: 'reports',
  },
  {
    name: 'monitor',
    href: '/dashboard/monitor',
    icon: Activity,
    featureKey: 'monitor',
    descriptionKey: 'description',
    descriptionNs: 'monitor',
  },
  {
    name: 'alerts',
    href: '/dashboard/alerts',
    icon: AlertTriangle,
    featureKey: 'alerts',
  },
  {
    name: 'settings',
    href: '/dashboard/settings',
    icon: Settings,
    descriptionKey: 'preferences',
    descriptionNs: 'settings',
  },
  {
    name: 'assistants',
    href: '/dashboard/assistants',
    icon: UserPlus,
    featureKey: 'assistants',
  },
];

/** Admin-only items appended after the main list. */
export const adminNavigationItems: NavigationItem[] = [
  {
    name: 'adminTeachers',
    href: '/dashboard/admin/teachers',
    icon: Users,
    roles: ['admin'],
  },
];

/**
 * Returns navigation items filtered by feature flags and the given role.
 * Used by both the sidebar and the dashboard page.
 */
export function getVisibleNavigation(role?: string): NavigationItem[] {
  const items = [...navigationItems, ...adminNavigationItems];

  return items.filter((item) => {
    if (item.featureKey && !isFeatureEnabled(item.featureKey)) return false;
    if (item.roles && role && !item.roles.includes(role as 'teacher' | 'admin')) return false;
    return true;
  });
}

/**
 * Map from URL segment → feature key.
 * Used by the dashboard layout to block routes for disabled features.
 */
export const routeFeatureMap: Record<string, FeatureKey> = {
  grades: 'grades',
  reports: 'reports',
  messages: 'messaging',
  courses: 'courses',
  monitor: 'monitor',
  assistants: 'assistants',
  alerts: 'alerts',
};
