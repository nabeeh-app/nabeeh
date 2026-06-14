'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';

interface DataSources {
  grades?: boolean;
  attendance?: boolean;
  trends?: boolean;
}

export function DataSourcesBadges({ sources }: { sources: DataSources }) {
  const t = useTranslations('reports.generation');
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-ink/60 uppercase tracking-wide font-body">
        {t('dataSource')}
      </h4>
      <div className="flex flex-wrap gap-2">
        {sources.grades != null && (
          <Badge variant="outline" className="text-xs">{t('gradesData')}</Badge>
        )}
        {sources.attendance != null && (
          <Badge variant="outline" className="text-xs">{t('attendanceData')}</Badge>
        )}
        {sources.trends != null && (
          <Badge variant="outline" className="text-xs">{t('trendsData')}</Badge>
        )}
      </div>
    </div>
  );
}
