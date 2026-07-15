'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SubjectStats {
  subject: string;
  total_assessments: number;
  average_score: number;
  highest_score: number;
  lowest_score: number;
  student_count: number;
}

interface GradeStatsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subjectStats: SubjectStats[];
}

export default function GradeStatsModal({
  open,
  onOpenChange,
  subjectStats,
}: GradeStatsModalProps) {
  const t = useTranslations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('grades.gradeStatistics')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {subjectStats.map((stat, index) => (
            <div key={index} className="p-4 bg-surface-sage/50 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{stat.subject}</h3>
                <Badge variant="outline">{t('grades.studentsCount', { count: stat.student_count })}</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-ink/60">{t('grades.averageLabel')}</div>
                  <div className="font-medium">{stat.average_score.toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-ink/60">{t('grades.stats.highestScore')}</div>
                  <div className="font-medium text-primary">{stat.highest_score}%</div>
                </div>
                <div>
                  <div className="text-ink/60">{t('grades.stats.lowestScore')}</div>
                  <div className="font-medium text-destructive">{stat.lowest_score}%</div>
                </div>
                <div>
                  <div className="text-ink/60">{t('grades.stats.totalAssessments')}</div>
                  <div className="font-medium">{stat.total_assessments}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
