import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Calendar } from 'lucide-react';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SchedulePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'comingSoon' });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calendar className="h-5 w-5 text-ink/40" />
        <h1 className="text-2xl font-semibold text-ink font-display">{t('title')}</h1>
      </div>
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center space-y-3 max-w-md">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink/40 font-mono">
            {t('title')}
          </p>
          <p className="text-sm text-ink/50 font-body">{t('description')}</p>
        </div>
      </div>
    </div>
  );
}
