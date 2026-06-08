import { setRequestLocale } from 'next-intl/server';
import ComingSoon from '@/components/ComingSoon';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function SchedulePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const title = locale === 'ar' ? 'الجدول الزمني' : 'Schedule';
  const description = locale === 'ar'
    ? 'عرض الجداول الزمنية تحت التطوير حالياً. سنفعّل هذه الصفحة بمجرد توفر البيانات.'
    : 'Schedule views are under construction. We will enable this page once data is available.';
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
