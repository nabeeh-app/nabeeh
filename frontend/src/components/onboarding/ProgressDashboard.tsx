'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { X, Check } from 'lucide-react';

const STORAGE_KEYS = {
  profileCompleted: 'nabeeh_profile_completed',
  hasStudents: 'nabeeh_has_students',
  hasAttendance: 'nabeeh_has_attendance',
  hasGrades: 'nabeeh_has_grades',
  dismissals: 'nabeeh_progress_dismissals',
  dismissedAt: 'nabeeh_progress_dismissed_at',
} as const;

const MAX_DISMISSALS = 3;
const REAPPEAR_DAYS = 7;
const REAPPEAR_MS = REAPPEAR_DAYS * 24 * 60 * 60 * 1000;

interface Checkpoint {
  key: keyof typeof STORAGE_KEYS;
  labelKey: string;
  weight: number;
}

const CHECKPOINTS: Checkpoint[] = [
  { key: 'profileCompleted', labelKey: 'profile', weight: 25 },
  { key: 'hasStudents', labelKey: 'firstStudent', weight: 25 },
  { key: 'hasAttendance', labelKey: 'firstAttendance', weight: 25 },
  { key: 'hasGrades', labelKey: 'firstGrade', weight: 25 },
];

export default function ProgressDashboard() {
  const t = useTranslations('onboarding.progress');
  const [visible, setVisible] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  const getPercentage = useCallback(() => {
    const completed = CHECKPOINTS.filter((cp) => completedSteps[cp.key]).length;
    return completed * 25;
  }, [completedSteps]);

  useEffect(() => {
    const dismissCount = parseInt(localStorage.getItem(STORAGE_KEYS.dismissals) || '0', 10);
    if (dismissCount >= MAX_DISMISSALS) return;

    const dismissedAt = localStorage.getItem(STORAGE_KEYS.dismissedAt);
    if (dismissedAt) {
      const elapsed = Date.now() - parseInt(dismissedAt, 10);
      if (elapsed < REAPPEAR_MS) return;
    }

    const steps: Record<string, boolean> = {};
    CHECKPOINTS.forEach((cp) => {
      steps[cp.key] = localStorage.getItem(STORAGE_KEYS[cp.key]) === 'true';
    });
    queueMicrotask(() => {
      setCompletedSteps(steps);
      setVisible(true);
    });
  }, []);

  const handleDismiss = () => {
    const count = parseInt(localStorage.getItem(STORAGE_KEYS.dismissals) || '0', 10) + 1;
    localStorage.setItem(STORAGE_KEYS.dismissals, String(count));
    localStorage.setItem(STORAGE_KEYS.dismissedAt, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  const percentage = getPercentage();
  const isComplete = percentage === 100;

  return (
    <div className="w-full border-b border-ink/10 bg-surface-sage/50">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        {/* Progress bar section */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-ink/60">
              {t('title')}
            </span>
            <span className="text-xs font-mono text-ink/60">{percentage}%</span>
          </div>

          {/* Thin bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>

          {/* Step indicators */}
          <div className="flex gap-1 pt-1">
            {CHECKPOINTS.map((cp) => (
              <div
                key={cp.key}
                className={`flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors duration-300 ${
                  completedSteps[cp.key]
                    ? 'bg-primary/15 text-primary'
                    : 'bg-ink/5 text-ink/40'
                }`}
              >
                {completedSteps[cp.key] ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-ink/20" />
                )}
                {t(`steps.${cp.labelKey}`)}
              </div>
            ))}
          </div>
        </div>

        {/* Dismiss button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          aria-label={t('dismiss')}
          className="shrink-0 h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Completion message */}
      {isComplete && (
        <div className="border-t border-primary/20 bg-primary/5 px-4 py-2 text-center">
          <p className="text-xs font-mono uppercase tracking-wider text-primary">
            {t('complete')}
          </p>
        </div>
      )}
    </div>
  );
}
