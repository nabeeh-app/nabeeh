'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api';
import { SEVERITY_CONFIG } from '@/lib/severityConfig';

interface Anomaly {
  student_id: string;
  student_name: string;
  pattern: string;
  severity: 'warning' | 'critical';
  detail: string;
}

interface AnomalyIndicatorProps {
  offeringId?: string;
}

export function AnomalyIndicator({ offeringId }: AnomalyIndicatorProps) {
  const t = useTranslations('attendance');
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchAnomalies = async () => {
      try {
        const params: Record<string, string> = {};
        if (offeringId) params.offering_id = offeringId;
        const res = await apiClient.getAlerts({ ...params, alert_type: 'trend_anomaly', limit: 20 });
        if (cancelled) return;
        if (res.success && Array.isArray(res.data)) {
          const mapped = res.data.map((a: { id: string; student_id: string | null; title: string; message: string; severity: string; metadata: Record<string, unknown> | null }) => ({
            student_id: a.student_id || '',
            student_name: (a.metadata?.student_name as string) || a.title,
            pattern: a.title,
            severity: a.severity as 'warning' | 'critical',
            detail: a.message,
          }));
          setAnomalies(mapped);
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchAnomalies();
    return () => { cancelled = true; };
  }, [offeringId]);

  if (loading) return null;

  if (anomalies.length === 0) return null;

  const criticalCount = anomalies.filter(a => a.severity === 'critical').length;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setExpanded(prev => !prev)}
      >
        <CardTitle className="flex items-center justify-between text-ink font-display">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            {t('anomaliesDetected')}
            <Badge variant={criticalCount > 0 ? 'destructive' : 'warning'} className="text-xs">
              {anomalies.length}
            </Badge>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-2 pt-0">
          {anomalies.map(anomaly => {
            const config = SEVERITY_CONFIG[anomaly.severity] || SEVERITY_CONFIG.warning;
            const Icon = config.icon;
            return (
              <div
                key={anomaly.student_id}
                className="flex items-start gap-3 p-3 rounded-lg border border-border bg-canvas"
              >
                <div className={`shrink-0 p-1.5 rounded-full ${config.bg}`}>
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink text-sm font-body">
                      {anomaly.student_name}
                    </span>
                    <Badge variant={config.variant} className="text-xs">
                      {t(`severity.${anomaly.severity}`)}
                    </Badge>
                  </div>
                  <p className="text-sm text-ink/70 font-body mt-0.5">
                    {anomaly.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
