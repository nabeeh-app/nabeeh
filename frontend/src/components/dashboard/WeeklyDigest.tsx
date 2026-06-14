'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import type { WeeklyDigest } from '@/types';

export function WeeklyDigest() {
  const t = useTranslations('digest');
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDigest = useCallback(async () => {
    try {
      const res = await apiClient.getLatestDigest();
      if (res.success && res.data) {
        setDigest(res.data as WeeklyDigest);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin h-8 w-8 border-b-2 border-ink mx-auto" />
        </CardContent>
      </Card>
    );
  }

  if (!digest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-ink font-display">
            <Calendar className="h-5 w-5" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-ink/60 font-body">
            <Calendar className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{t('noDigest')}</p>
            <p className="text-sm mt-1">{t('noDigestDesc')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { digest_data } = digest;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-ink font-display">
          <Calendar className="h-5 w-5" />
          {t('title')}
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          {formatDate(digest.week_start)} – {formatDate(digest.week_end)}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {digest_data.improved.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <h4 className="text-sm font-semibold text-ink font-body">
                {t('improved')}
              </h4>
              <Badge variant="success" className="text-xs">
                {digest_data.improved.length}
              </Badge>
            </div>
            <div className="space-y-1">
              {digest_data.improved.slice(0, 3).map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm p-2 rounded bg-green-500/5 border border-green-500/10"
                >
                  <span className="font-body text-ink">
                    <span className="font-medium">{item.student_name}</span>
                    {' — '}
                    {item.metric}
                  </span>
                  <ChevronRight className="h-4 w-4 text-ink/40 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {digest_data.declining.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <h4 className="text-sm font-semibold text-ink font-body">
                {t('declining')}
              </h4>
              <Badge variant="destructive" className="text-xs">
                {digest_data.declining.length}
              </Badge>
            </div>
            <div className="space-y-1">
              {digest_data.declining.slice(0, 3).map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm p-2 rounded bg-destructive/5 border border-destructive/10"
                >
                  <span className="font-body text-ink">
                    <span className="font-medium">{item.student_name}</span>
                    {' — '}
                    {item.metric}
                  </span>
                  <ChevronRight className="h-4 w-4 text-ink/40 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {digest_data.action_items.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <h4 className="text-sm font-semibold text-ink font-body">
                {t('actionItems')}
              </h4>
            </div>
            <ul className="space-y-1">
              {digest_data.action_items.slice(0, 3).map((item, i) => (
                <li
                  key={i}
                  className="text-sm text-ink/70 font-body pl-4 relative before:content-['•'] before:absolute before:left-0 before:text-ink/40"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-2">
          <Button variant="ghost" size="sm" className="w-full">
            {t('viewFullReport')}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
