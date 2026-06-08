'use client';

import Link from 'next/link';
import { Sidebar } from '@/components/sidebar';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { isFeatureEnabled, type FeatureKey } from '@/config/featureFlags';

const featureRouteMap: Record<string, FeatureKey> = {
  grades: 'grades',
  reports: 'reports',
  messages: 'messaging',
  courses: 'courses',
  monitor: 'monitor',
};

const getBlockedFeature = (pathname: string | null) => {
  if (!pathname) {
    return null;
  }

  const segments = pathname.split('/').filter(Boolean);
  const dashboardIndex = segments.indexOf('dashboard');
  if (dashboardIndex === -1) {
    return null;
  }

  const section = segments[dashboardIndex + 1];
  const featureKey = section ? featureRouteMap[section] : undefined;
  if (!featureKey) {
    return null;
  }

  return isFeatureEnabled(featureKey) ? null : featureKey;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = useLocale();
  const pathname = usePathname();
  const blockedFeature = getBlockedFeature(pathname);
  const redirectTo = `/${locale}/login`;

  return (
    <ProtectedRoute
      redirectTo={redirectTo}
      fallback={(
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      )}
    >
      <div className="flex h-screen bg-background">
        <Sidebar />
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {blockedFeature ? (
              <div className="flex min-h-[60vh] items-center justify-center">
                <div className="max-w-md text-center space-y-4">
                  <h2 className="text-2xl font-semibold text-foreground">Coming soon</h2>
                  <p className="text-muted-foreground">
                    This feature is not available yet. Enable it when it is ready to launch.
                  </p>
                  <Button asChild>
                    <Link href={`/${locale}/dashboard`}>Back to dashboard</Link>
                  </Button>
                </div>
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
