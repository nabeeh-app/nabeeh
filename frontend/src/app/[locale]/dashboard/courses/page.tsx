import { setRequestLocale } from 'next-intl/server';
import ComingSoon from '@/components/ComingSoon';

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function CoursesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const title = locale === 'ar' ? 'الدورات' : 'Courses';
  const description = locale === 'ar'
    ? 'إدارة الدورات قيد الإعداد حالياً. سنفعل هذه الصفحة بعد تجهيز بيانات الدورات.'
    : 'Course management is being prepared. We will enable this page once course data is ready.';
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
