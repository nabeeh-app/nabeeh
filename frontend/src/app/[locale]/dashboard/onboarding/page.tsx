'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, BookOpen, MessageSquare, CheckCircle } from 'lucide-react';

const TOTAL_STEPS = 4;
const STEP_ICONS = [User, BookOpen, MessageSquare, CheckCircle] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('onboarding');
  const tCommon = useTranslations('common');

  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [subjects, setSubjects] = useState('');
  const [whatsappConnected, setWhatsappConnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const completed = localStorage.getItem('nabeeh_profile_completed');
    if (completed === 'true') {
      router.replace(`/${locale}/dashboard`);
      return;
    }

    const savedStep = localStorage.getItem('nabeeh_onboarding_step');
    if (savedStep) {
      const parsed = parseInt(savedStep, 10);
      if (parsed >= 0 && parsed < TOTAL_STEPS) {
        setStep(parsed);
      }
    }

    setMounted(true);
  }, [router, locale]);

  const saveProgress = (nextStep: number) => {
    localStorage.setItem('nabeeh_onboarding_step', String(nextStep));
  };

  const goToStep = (nextStep: number) => {
    setTransitioning(true);
    setTimeout(() => {
      setStep(nextStep);
      saveProgress(nextStep);
      setTransitioning(false);
    }, 200);
  };

  const handleNext = () => {
    if (step < TOTAL_STEPS - 1) {
      goToStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      goToStep(step - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('nabeeh_profile_completed', 'true');
    localStorage.removeItem('nabeeh_onboarding_step');
    router.push(`/${locale}/dashboard`);
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const Icon = STEP_ICONS[step];

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-12">
      <div className="w-full max-w-lg space-y-8">
        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-3">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold font-mono uppercase transition-all duration-300 ${
                  i < step
                    ? 'bg-primary text-primary-foreground'
                    : i === step
                      ? 'bg-accent text-ink ring-2 ring-primary'
                      : 'bg-surface-sage text-ink/40'
                }`}
              >
                {i < step ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  i + 1
                )}
              </div>
              {i < TOTAL_STEPS - 1 && (
                <div
                  className={`h-0.5 w-12 transition-colors duration-300 ${
                    i < step ? 'bg-primary' : 'bg-surface-sage'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div
          className={`bg-canvas rounded-lg shadow-[0_1px_3px_rgba(8,61,68,0.06)] p-8 transition-all duration-200 ${
            transitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
          }`}
        >
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
              <Icon className="h-8 w-8 text-primary" />
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-ink font-display">
                {t(`steps.${['profile', 'subjects', 'whatsapp', 'done'][step]}`)}
              </h1>
              <p className="text-base text-ink/60 font-body">
                {step === 0 && t('profile.description')}
                {step === 1 && t('subjects.description')}
                {step === 2 && t('whatsapp.description')}
                {step === 3 && t('done.description')}
              </p>
            </div>

            {/* Step 0: Profile */}
            {step === 0 && (
              <div className="w-full space-y-4 text-left">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('profile.nameLabel')}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('profile.namePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('profile.phoneLabel')}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('profile.phonePlaceholder')}
                  />
                </div>
              </div>
            )}

            {/* Step 1: Subjects */}
            {step === 1 && (
              <div className="w-full text-left">
                <div className="space-y-2">
                  <Label htmlFor="subjects">{t('subjects.title')}</Label>
                  <Input
                    id="subjects"
                    value={subjects}
                    onChange={(e) => setSubjects(e.target.value)}
                    placeholder={t('subjects.placeholder')}
                  />
                </div>
              </div>
            )}

            {/* Step 2: WhatsApp */}
            {step === 2 && (
              <div className="w-full space-y-4">
                <Button
                  variant={whatsappConnected ? 'default' : 'outline'}
                  className="w-full"
                  onClick={() => setWhatsappConnected(!whatsappConnected)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {whatsappConnected ? t('whatsapp.connect') : t('whatsapp.skip')}
                </Button>
              </div>
            )}

            {/* Step 3: Done */}
            {step === 3 && (
              <div className="w-full">
                <Button className="w-full" onClick={handleComplete}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('done.goToDashboard')}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        {step < 3 && (
          <div className="flex justify-between gap-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={step === 0}
            >
              {tCommon('back')}
            </Button>
            <Button onClick={handleNext}>
              {step === 2 ? t('whatsapp.skip') : tCommon('next')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
