'use client';

import { Sidebar } from '@/components/sidebar';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { GridPattern } from '@/components/ui/grid-pattern';
import { isFeatureEnabled } from '@/config/featureFlags';
import { routeFeatureMap } from '@/config/navigation';
import ComingSoon from '@/components/ComingSoon';

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
  const featureKey = section ? routeFeatureMap[section] : undefined;
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
  const t = useTranslations('comingSoon');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const blockedFeature = getBlockedFeature(pathname);
  const redirectTo = `/${locale}/login`;

  return (
    <ProtectedRoute
      redirectTo={redirectTo}
      fallback={(
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-b-2 border-ink mx-auto"></div>
            <p className="mt-4 text-ink/60 font-mono uppercase tracking-wider">{tCommon('loading')}</p>
          </div>
        </div>
      )}
    >
      <div className="flex h-screen bg-canvas">
        <Sidebar />
        <div className="flex-1 overflow-y-auto relative">
          <GridPattern
            width={30}
            height={30}
            squares={[[1, 1], [4, 3], [7, 5], [10, 2], [13, 6]]}
            className="opacity-50"
          />
          <div className="p-6 relative z-10">
            {blockedFeature ? (
              <ComingSoon
                title={t('title')}
                description={t('description')}
                backHref={`/${locale}/dashboard`}
                backLabel={t('backLabel')}
              />
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
