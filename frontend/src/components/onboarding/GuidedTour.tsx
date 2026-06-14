'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Info,
  Users,
  Calendar,
  GraduationCap,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const TOUR_KEY = 'nabeeh_tour_completed';

interface TourStep {
  targetSelector: string;
  title: { en: string; ar: string };
  description: { en: string; ar: string };
  icon: React.ComponentType<{ className?: string }>;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    targetSelector: '[data-tour="dashboard"]',
    title: { en: 'This is your dashboard', ar: 'لوحة التحكم' },
    description: {
      en: 'Your central hub for managing students, attendance, and grades.',
      ar: 'مركزك لإدارة الطلاب والحضور والدرجات.',
    },
    icon: Info,
    placement: 'bottom',
  },
  {
    targetSelector: '[data-tour="students"]',
    title: { en: 'Add your first students', ar: 'أضف طلابك الأولين' },
    description: {
      en: 'Create student profiles to start tracking their progress.',
      ar: 'أنشئ ملفات الطلاب لبدء تتبع تقدمهم.',
    },
    icon: Users,
    placement: 'right',
  },
  {
    targetSelector: '[data-tour="attendance"]',
    title: { en: 'Track attendance', ar: 'تتبع الحضور' },
    description: {
      en: 'Mark attendance for each session and monitor patterns.',
      ar: 'تسجيل الحضور لكل جلسة ومتابعة الأنماط.',
    },
    icon: Calendar,
    placement: 'right',
  },
  {
    targetSelector: '[data-tour="grades"]',
    title: { en: 'View grades', ar: 'عرض الدرجات' },
    description: {
      en: 'Enter grades and view detailed performance analytics.',
      ar: 'أدخل الدرجات وعرض تحليلات الأداء التفصيلية.',
    },
    icon: GraduationCap,
    placement: 'top',
  },
];

interface SpotlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GuidedTourProps {
  forceShow?: boolean;
}

export function GuidedTour({ forceShow }: GuidedTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const t = useTranslations('onboarding');

  const isTourCompleted = (): boolean => {
    try {
      return localStorage.getItem(TOUR_KEY) === 'true';
    } catch {
      return false;
    }
  };

  const markTourCompleted = () => {
    try {
      localStorage.setItem(TOUR_KEY, 'true');
    } catch {}
  };

  useEffect(() => {
    if (forceShow) {
      setIsVisible(true);
      setCurrentStep(0);
      return;
    }

    if (!isTourCompleted()) {
      const timer = setTimeout(() => setIsVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  const getTargetRect = useCallback((selector: string): DOMRect | null => {
    const el = document.querySelector(selector);
    if (!el) return null;
    return el.getBoundingClientRect();
  }, []);

  const updateSpotlight = useCallback(
    (stepIndex: number) => {
      const step = TOUR_STEPS[stepIndex];
      if (!step) return;

      const rect = getTargetRect(step.targetSelector);
      if (!rect) {
        setSpotlight(null);
        return;
      }

      const padding = 12;
      setSpotlight({
        x: rect.x - padding,
        y: rect.y - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      });
    },
    [getTargetRect],
  );

  useEffect(() => {
    if (!isVisible) return;
    updateSpotlight(currentStep);

    const handleResize = () => updateSpotlight(currentStep);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isVisible, currentStep, updateSpotlight]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
        setIsAnimating(false);
      }, 150);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep((prev) => prev - 1);
        setIsAnimating(false);
      }, 150);
    }
  };

  const handleComplete = () => {
    setIsVisible(false);
    markTourCompleted();
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      handleNext();
    }
  };

  if (!isVisible) return null;

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const tooltipText = t('tooltip_step', { current: currentStep + 1, total: TOUR_STEPS.length });

  const getTooltipPosition = (): React.CSSProperties => {
    if (!spotlight) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const tooltipWidth = 340;
    const tooltipHeight = 220;
    const gap = 16;
    const placement = step.placement || 'bottom';

    let top: number;
    let left: number;

    switch (placement) {
      case 'top':
        top = spotlight.y - tooltipHeight - gap;
        left = spotlight.x + spotlight.width / 2 - tooltipWidth / 2;
        break;
      case 'left':
        top = spotlight.y + spotlight.height / 2 - tooltipHeight / 2;
        left = spotlight.x - tooltipWidth - gap;
        break;
      case 'right':
        top = spotlight.y + spotlight.height / 2 - tooltipHeight / 2;
        left = spotlight.x + spotlight.width + gap;
        break;
      case 'bottom':
      default:
        top = spotlight.y + spotlight.height + gap;
        left = spotlight.x + spotlight.width / 2 - tooltipWidth / 2;
        break;
    }

    left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
    top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

    return { top: `${top}px`, left: `${left}px` };
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleOverlayClick}
    >
      <div
        className="absolute inset-0 bg-black/60 transition-opacity duration-300"
        style={{
          maskImage: spotlight
            ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${spotlight.x}px ${spotlight.y}px, ${spotlight.x}px ${spotlight.y + spotlight.height}px, ${spotlight.x + spotlight.width}px ${spotlight.y + spotlight.height}px, ${spotlight.x + spotlight.width}px ${spotlight.y}px, ${spotlight.x}px ${spotlight.y}px)`
            : undefined,
          WebkitMaskImage: spotlight
            ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${spotlight.x}px ${spotlight.y}px, ${spotlight.x}px ${spotlight.y + spotlight.height}px, ${spotlight.x + spotlight.width}px ${spotlight.y + spotlight.height}px, ${spotlight.x + spotlight.width}px ${spotlight.y}px, ${spotlight.x}px ${spotlight.y}px)`
            : undefined,
        }}
      />

      {spotlight && (
        <div
          className="absolute rounded-lg ring-2 ring-white/80 pointer-events-none transition-all duration-300 ease-out"
          style={{
            top: spotlight.y,
            left: spotlight.x,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: '0 0 0 4000px rgba(0,0,0,0.6)',
          }}
        />
      )}

      <div
        ref={tooltipRef}
        className={`absolute w-[340px] bg-canvas border border-border shadow-xl rounded-none transition-all duration-200 ${
          isAnimating ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
        }`}
        style={getTooltipPosition()}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-primary" />
              <h3 className="font-display font-semibold text-ink text-lg">
                {step.title.en}
              </h3>
            </div>
            <button
              onClick={handleSkip}
              className="text-ink/40 hover:text-ink transition-colors"
              aria-label="Close tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="font-body text-ink/70 text-sm leading-relaxed mb-4">
            {step.description.en}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? 'w-6 bg-primary'
                      : i < currentStep
                        ? 'w-1.5 bg-primary/40'
                        : 'w-1.5 bg-ink/15'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkip}
                className="text-ink/50 hover:text-ink text-xs"
              >
                {t('skip')}
              </Button>

              {currentStep > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  className="gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {t('prev')}
                </Button>
              )}

              <Button
                variant="default"
                size="sm"
                onClick={handleNext}
                className="gap-1"
              >
                {isLast ? t('done') : t('next')}
                {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
