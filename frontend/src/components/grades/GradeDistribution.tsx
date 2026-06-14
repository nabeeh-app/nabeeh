'use client';

import { useTranslations } from 'next-intl';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import type { GradeDistribution as GradeDistributionType } from '@/types';

const DISTRIBUTION_COLORS = ['#C8DFE8', '#7BA7A7', '#4F6D7A', '#A0C4B8', '#D4A574', '#E8C9A0', '#B8860B', '#CD853F', '#8B4513', '#2F4F4F'];

interface GradeDistributionProps {
  data: GradeDistributionType[];
  assessmentName?: string;
}

export function GradeDistribution({ data, assessmentName }: GradeDistributionProps) {
  const t = useTranslations('grades.analysis');

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-ink font-display">
            <BarChart3 className="h-5 w-5" />
            {t('gradeDistribution')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-ink/60 font-body">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{t('noDistributionData')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-ink font-display">
          <BarChart3 className="h-5 w-5" />
          {t('gradeDistribution')}
          {assessmentName && (
            <span className="text-sm font-normal text-ink/60 ml-2">— {assessmentName}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="range"
                tick={{ fill: 'var(--ink)', fontSize: 11, fontFamily: 'var(--font-body)' }}
                axisLine={{ stroke: 'var(--border)' }}
              />
              <YAxis
                tick={{ fill: 'var(--ink)', fontSize: 12, fontFamily: 'var(--font-body)' }}
                axisLine={{ stroke: 'var(--border)' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-body)',
                }}
                formatter={(value) => [value, t('studentCount')]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={index} fill={DISTRIBUTION_COLORS[index % DISTRIBUTION_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
