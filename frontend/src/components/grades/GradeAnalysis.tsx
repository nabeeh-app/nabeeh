'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { BarChart3, Users, AlertTriangle, TrendingUp, BookOpen } from 'lucide-react';
import { StatCards } from '@/components/ui/StatCards';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/client';
import { useOfferings } from '@/hooks/useOfferings';
import { featureFlags } from '@/config/featureFlags';
import { GroupComparison } from './GroupComparison';
import { AtRiskStudents } from './AtRiskStudents';
import { GradeDistribution } from './GradeDistribution';
import { TrendChart } from './TrendChart';
import type { GroupComparison as GroupComparisonType, AtRiskStudent, GradeDistribution as GradeDistributionType, GradeTrend, GradeOverview } from '@/types';

export function GradeAnalysis() {
  const tAnalysis = useTranslations('grades.analysis');
  const locale = useLocale();

  const { data: offerings, isLoading: offeringsLoading } = useOfferings();
  const [selectedOffering, setSelectedOffering] = useState<string>('');
  const [overview, setOverview] = useState<GradeOverview | null>(null);
  const [groupData, setGroupData] = useState<GroupComparisonType[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskStudent[]>([]);
  const [distribution] = useState<GradeDistributionType[]>([]);
  const [trends] = useState<GradeTrend[]>([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  useEffect(() => {
    if (offerings && offerings.length > 0 && !selectedOffering) {
      queueMicrotask(() => setSelectedOffering(offerings[0].id));
    }
  }, [offerings, selectedOffering]);

  const loadAnalysis = useCallback(async (offeringId: string) => {
    if (!offeringId) return;
    setLoadingAnalysis(true);
    try {
      const [overviewRes, groupRes, atRiskRes] = await Promise.allSettled([
        apiClient.getGradeOverview(offeringId),
        apiClient.getGroupComparison(offeringId),
        apiClient.getAtRiskStudents(offeringId),
      ]);

      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value as GradeOverview);
      }
      if (groupRes.status === 'fulfilled') {
        setGroupData(groupRes.value as GroupComparisonType[]);
      }
      if (atRiskRes.status === 'fulfilled') {
        setAtRisk(atRiskRes.value as AtRiskStudent[]);
      }
    } catch {
      // silent
    } finally {
      setLoadingAnalysis(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOffering) {
      void (async () => {
        await loadAnalysis(selectedOffering);
      })();
    }
  }, [selectedOffering, loadAnalysis]);

  if (offeringsLoading) {
    return <LoadingSpinner />;
  }

  if ((offerings || []).length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        message={tAnalysis('noOfferings')}
        description={tAnalysis('noOfferingsDesc')}
      />
    );
  }

  const statItems = overview ? [
    { icon: Users, value: overview.total_students, label: tAnalysis('totalStudents'), color: 'primary' as const },
    { icon: BookOpen, value: overview.total_grades, label: tAnalysis('totalGrades'), color: 'accent' as const },
    { icon: TrendingUp, value: `${overview.average.toFixed(1)}%`, label: tAnalysis('averageScore'), color: 'success' as const },
    { icon: AlertTriangle, value: atRisk.length, label: tAnalysis('atRisk'), color: 'warning' as const },
  ] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Select value={selectedOffering} onValueChange={setSelectedOffering}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder={tAnalysis('selectOffering')} />
          </SelectTrigger>
          <SelectContent>
            {(offerings || []).map(o => (
              <SelectItem key={o.id} value={o.id}>
                {locale === 'ar' ? o.subject.name_ar : o.subject.name_en} — {o.grade_level.name} ({o.academic_year})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {overview && <StatCards stats={statItems} />}

      {loadingAnalysis ? (
        <div className="py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <GroupComparison data={groupData} />
          <AtRiskStudents data={atRisk} />
          {/* TODO: Add assessment selector to populate distribution data */}
          {/* TODO: Add student selector to populate trend data */}
          {featureFlags.gradeAnalysis && (
            <>
              <GradeDistribution data={distribution} />
              <TrendChart data={trends} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
