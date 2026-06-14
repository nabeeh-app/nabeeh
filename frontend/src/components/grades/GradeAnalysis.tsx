'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { BarChart3, Users, AlertTriangle, TrendingUp, BookOpen } from 'lucide-react';
import { StatCards } from '@/components/ui/StatCards';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api';
import { GroupComparison } from './GroupComparison';
import { AtRiskStudents } from './AtRiskStudents';
import { GradeDistribution } from './GradeDistribution';
import { TrendChart } from './TrendChart';
import type { GroupComparison as GroupComparisonType, AtRiskStudent, GradeDistribution as GradeDistributionType, GradeTrend, GradeOverview, Offering } from '@/types';

export function GradeAnalysis() {
  const t = useTranslations('grades');
  const tAnalysis = useTranslations('grades.analysis');
  const tCommon = useTranslations('common');

  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [selectedOffering, setSelectedOffering] = useState<string>('');
  const [overview, setOverview] = useState<GradeOverview | null>(null);
  const [groupData, setGroupData] = useState<GroupComparisonType[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskStudent[]>([]);
  const [distribution, setDistribution] = useState<GradeDistributionType[]>([]);
  const [trends, setTrends] = useState<GradeTrend[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient.getOfferings().then(data => {
      if (cancelled) return;
      if (Array.isArray(data)) {
        setOfferings(data);
        if (data.length > 0) {
          setSelectedOffering(data[0].id);
        }
      }
    }).catch(() => {}).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const loadAnalysis = useCallback(async (offeringId: string) => {
    if (!offeringId) return;
    setLoadingAnalysis(true);
    try {
      const [overviewRes, groupRes, atRiskRes] = await Promise.allSettled([
        apiClient.getGradeOverview(offeringId),
        apiClient.getGroupComparison(offeringId),
        apiClient.getAtRiskStudents(offeringId),
      ]);

      if (overviewRes.status === 'fulfilled' && overviewRes.value.success) {
        setOverview(overviewRes.value.data as GradeOverview);
      }
      if (groupRes.status === 'fulfilled' && groupRes.value.success) {
        setGroupData(groupRes.value.data as GroupComparisonType[]);
      }
      if (atRiskRes.status === 'fulfilled' && atRiskRes.value.success) {
        setAtRisk(atRiskRes.value.data as AtRiskStudent[]);
      }
    } catch {
      // silent
    } finally {
      setLoadingAnalysis(false);
    }
  }, []);

  useEffect(() => {
    if (selectedOffering) {
      loadAnalysis(selectedOffering);
    }
  }, [selectedOffering, loadAnalysis]);

  useEffect(() => {
    if (!selectedStudent) {
      // Reset via async to avoid synchronous setState in effect
      void Promise.resolve().then(() => {
        setDistribution([]);
        setTrends([]);
      });
      return;
    }
    apiClient.getGradeTrends(selectedStudent).then(res => {
      if (res.success) setTrends(res.data as GradeTrend[]);
    }).catch(() => {});
  }, [selectedStudent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-b-2 border-ink mx-auto" />
      </div>
    );
  }

  if (offerings.length === 0) {
    return (
      <div className="text-center py-16 text-ink/60 font-body">
        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-40" />
        <p className="text-lg">{tAnalysis('noOfferings')}</p>
        <p className="text-sm mt-1">{tAnalysis('noOfferingsDesc')}</p>
      </div>
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
            {offerings.map(o => (
              <SelectItem key={o.id} value={o.id}>
                {o.subject.name_en} — {o.grade_level.name} ({o.academic_year})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {overview && <StatCards stats={statItems} />}

      {loadingAnalysis ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-b-2 border-ink mx-auto" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <GroupComparison data={groupData} />
          <AtRiskStudents data={atRisk} />
          <GradeDistribution data={distribution} />
          <TrendChart data={trends} />
        </div>
      )}
    </div>
  );
}
