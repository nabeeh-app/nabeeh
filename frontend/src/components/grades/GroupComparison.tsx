'use client';

import { useTranslations } from 'next-intl';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import type { GroupComparison as GroupComparisonType } from '@/types';

const COLORS = ['#4F6D7A', '#7BA7A7', '#A0C4B8', '#C8DFE8', '#D4A574', '#E8C9A0'];

interface GroupComparisonProps {
  data: GroupComparisonType[];
}

export function GroupComparison({ data }: GroupComparisonProps) {
  const t = useTranslations('grades.analysis');

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-ink font-display">
            <BarChart3 className="h-5 w-5" />
            {t('groupComparison')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-ink/60 font-body">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{t('noGroupData')}</p>
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
          {t('groupComparison')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="group_name"
                tick={{ fill: 'var(--ink)', fontSize: 12, fontFamily: 'var(--font-body)' }}
                axisLine={{ stroke: 'var(--border)' }}
              />
              <YAxis
                tick={{ fill: 'var(--ink)', fontSize: 12, fontFamily: 'var(--font-body)' }}
                axisLine={{ stroke: 'var(--border)' }}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-canvas)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontFamily: 'var(--font-body)',
                }}
                formatter={(value) => [`${Number(value).toFixed(1)}%`, t('averageScore')]}
              />
              <Bar dataKey="average_score" radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-3 mt-4">
          {data.map((group, i) => (
            <div key={group.group_id} className="flex items-center gap-2 text-sm font-body">
              <span
                className="h-3 w-3 rounded-sm shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-ink/70">
                {group.group_name}: {group.average_score.toFixed(1)}% ({group.student_count} {t('students')})
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
