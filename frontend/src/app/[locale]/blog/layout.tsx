import type { Metadata } from 'next';

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

const seo: Record<string, { title: string; description: string }> = {
  en: {
    title: 'Blog - Tutoring Tips, Attendance & Grade Management',
    description: 'Practical guides for private tutors: attendance tracking, grade management, parent communication, WhatsApp automation, and growing your tutoring business.',
  },
  ar: {
    title: 'المدونة - نصائح الدروس الخصوصية وإدارة الحضور والدرجات',
    description: 'أدلة عملية للمدرسين الخواص: تتبع الحضور، إدارة الدرجات، التواصل مع أولياء الأمور، أتمتة الواتساب، وتنمية بزنس الدروس.',
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const m = seo[locale] || seo.en;
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: `https://nabeeh.app/${locale}/blog` },
  };
}

export default async function BlogLayout({ children }: Props) {
  return <>{children}</>;
}
