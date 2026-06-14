'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEffect, useState } from 'react';
import apiClient from '@/lib/client';
import logger from '@/lib/logger';
import { PageHeader } from '@/components/ui/PageHeader';
import { Offering } from '@/types';
import {
  Plus,
  Clock,
  Loader2
} from 'lucide-react';

export default function ClassesPage() {
  const t = useTranslations('classes');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const setupRequired = searchParams.get('setup') === 'required';
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClasses = async () => {
    try {
      const data = await apiClient.getOfferings();
      setOfferings(data);
    } catch (error) {
      logger.error('Failed to fetch classes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      await fetchClasses();
    })();
  }, []);

  const getStatusBadge = (isActive: boolean) => {
    return isActive ?
      { label: t('active'), variant: 'default' as const } :
      { label: t('inactive'), variant: 'secondary' as const };
  };

  // Flatten Offerings -> Groups
  // Each Group is a "Class" to display
  const classesList = offerings.flatMap(offering =>
    offering.groups.map((group) => ({
      id: group.id,
      name: group.name,
      subject: offering.subject.name_en, // Or localized
      grade: offering.grade_level.name,
      schedule: group.schedule_description,
      active: offering.is_active
    }))
  );

  return (
    <div className="space-y-6">
      {setupRequired && (
        <div className="rounded-lg border border-ink/20 bg-surface-sage p-4 text-ink">
          <p className="text-sm font-semibold">
            {t('setupRequired')}
          </p>
          <p className="text-sm text-ink/70">
            {t('setupDescription')}
          </p>
        </div>
      )}
      {/* Header */}
      <PageHeader title={t('title')} description={t('description')}>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          {t('addClass')}
        </Button>
      </PageHeader>

      {/* Classes Table */}
      <div className="space-y-0">
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('groupName')}</TableHead>
                <TableHead>{t('subject')}</TableHead>
                <TableHead>{t('gradeLevel')}</TableHead>
                <TableHead>{t('schedule')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classesList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">{t('noClasses')}</TableCell>
                </TableRow>
              ) : classesList.map((cls) => {
                const status = getStatusBadge(cls.active);
                return (
                  <TableRow key={cls.id}>
                    <TableCell className="font-medium">
                      {cls.name}
                    </TableCell>
                    <TableCell>{cls.subject}</TableCell>
                    <TableCell>{cls.grade}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-ink/40" />
                        {cls.schedule || t('na')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          {tc('edit')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
