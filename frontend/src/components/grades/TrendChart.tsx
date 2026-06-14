'use client';

import { useTranslations } from 'next-intl';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import type { GradeTrend } from '@/types';

interface TrendChartProps {
  data: GradeTrend[];
  studentName?: string;
}

export function TrendChart({ data, studentName }: TrendChartProps) {
  const t = useTranslations('grades.analysis');

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-ink font-display">
            <TrendingUp className="h-5 w-5" />
            {t('gradeTrends')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-ink/60 font-body">
            <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{t('noTrendData')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-ink font-display">
          <TrendingUp className="h-5 w-5" />
          {t('gradeTrends')}
          {studentName && (
            <span className="text-sm font-normal text-ink/60 ml-2">— {studentName}</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="assessment_name"
                tick={{ fill: 'var(--ink)', fontSize: 11, fontFamily: 'var(--font-body)' }}
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
                formatter={(value) => [`${Number(value).toFixed(1)}%`, t('score')]}
                labelFormatter={(label) => `${t('assessment')}: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={{ fill: 'var(--primary)', r: 4 }}
                activeDot={{ r: 6, fill: 'var(--primary)' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
