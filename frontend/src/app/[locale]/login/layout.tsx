import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  const titles: Record<string, string> = {
    en: "Log in to Nabeeh - Smart Teaching Assistant",
    ar: "تسجيل الدخول إلى نبيه - مساعد تعليمي ذكي",
  };

  const descriptions: Record<string, string> = {
    en: "Log in to your Nabeeh account to manage students, track attendance, and communicate with parents via WhatsApp.",
    ar: "سجل الدخول إلى حسابك في نبيه لإدارة الطلاب وتتبع الحضور والتواصل مع أولياء الأمور عبر واتساب.",
  };

  return {
    title: titles[locale] || titles.en,
    description: descriptions[locale] || descriptions.en,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `https://nabeeh.app/${locale}/login`,
      languages: {
        en: "https://nabeeh.app/en/login",
        ar: "https://nabeeh.app/ar/login",
      },
    },
  };
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
