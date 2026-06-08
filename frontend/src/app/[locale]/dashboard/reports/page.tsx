import { setRequestLocale } from 'next-intl/server';
import ComingSoon from '@/components/ComingSoon';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ReportsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const title = locale === 'ar' ? 'التقارير' : 'Reports';
  const description = locale === 'ar'
    ? 'التقارير قيد الإعداد حالياً. سنفعّل هذه الصفحة عندما تصبح المقاييس جاهزة.'
    : 'Reports are being prepared. We will enable this page when metrics are ready.';
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
