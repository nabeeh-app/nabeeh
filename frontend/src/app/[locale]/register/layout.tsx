import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const titles: Record<string, string> = {
    en: "Create your Nabeeh account - Free for tutors",
    ar: "أنشئ حسابك في نبيه - مجاني للمعلمين",
  };

  const descriptions: Record<string, string> = {
    en: "Sign up for free to manage your students, track attendance, handle grades, and automate parent communication via WhatsApp.",
    ar: "سجّل مجانًا لإدارة طلابك وتتبع الحضور وإدارة الدرجات وأتمتة التواصل مع أولياء الأمور عبر واتساب.",
  };

  return {
    title: titles[locale] || titles.en,
    description: descriptions[locale] || descriptions.en,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `https://nabeeh.app/${locale}/register`,
      languages: {
        en: "https://nabeeh.app/en/register",
        ar: "https://nabeeh.app/ar/register",
      },
    },
  };
}

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
