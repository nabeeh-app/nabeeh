import { setRequestLocale } from 'next-intl/server';
import ComingSoon from '@/components/ComingSoon';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SystemMonitorPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const title = locale === 'ar' ? 'مراقب النظام' : 'System Monitor';
  const description = locale === 'ar'
    ? 'مراقبة النظام قيد الإعداد حالياً. سنفعّل هذه الصفحة عند توفر مؤشرات التشغيل.'
    : 'System monitoring is being prepared. We will enable this page once telemetry is available.';
  const badgeLabel = locale === 'ar' ? 'قريباً' : 'Coming soon';
  const backLabel = locale === 'ar'
    ? 'العودة إلى لوحة التحكم'
    : 'Back to dashboard';

  return (
    <ComingSoon
      title={title}
      description={description}
      badgeLabel={badgeLabel}
      backLabel={backLabel}
      backHref={`/${locale}/dashboard`}
    />
  );
}
