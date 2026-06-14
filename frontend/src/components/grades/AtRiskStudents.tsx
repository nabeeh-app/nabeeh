'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { AtRiskStudent } from '@/types';

const SEVERITY_CONFIG = {
  warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', variant: 'warning' as const },
  critical: { icon: AlertCircle, color: 'text-destructive', bg: 'bg-destructive/10', variant: 'destructive' as const },
};

interface AtRiskStudentsProps {
  data: AtRiskStudent[];
}

export function AtRiskStudents({ data }: AtRiskStudentsProps) {
  const t = useTranslations('grades.analysis');

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-ink font-display">
            <AlertTriangle className="h-5 w-5" />
            {t('atRiskStudents')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-ink/60 font-body">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>{t('noAtRiskStudents')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-ink font-display">
          <AlertTriangle className="h-5 w-5" />
          {t('atRiskStudents')}
          <Badge variant="destructive" className="ml-1">{data.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map(student => {
            const config = SEVERITY_CONFIG[student.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.warning;
            const Icon = config.icon;
            return (
              <div
                key={student.student_id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-canvas"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`shrink-0 p-1.5 rounded-full ${config.bg}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-ink text-sm font-body truncate">
                      {student.student_name}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-ink/60 font-body">
                        {t('avgGrade')}: {student.average_grade != null ? `${student.average_grade.toFixed(1)}%` : 'N/A'}
                      </span>
                      <span className="text-xs text-ink/60 font-body">
                        {t('attendance')}: {student.attendance_rate != null ? `${student.attendance_rate.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
                <Badge variant={config.variant}>
                  {t(`severity.${student.severity}`)}
                </Badge>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
