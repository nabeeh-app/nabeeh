import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { AuthProvider } from '@/hooks/useAuth';
import { LocaleProvider } from '@/components/locale-provider';
import QueryProvider from '@/components/QueryProvider';
import { CookieNotice } from '@/components/CookieNotice';
import { notFound } from 'next/navigation';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

const localeNames: Record<string, { title: string; description: string; ogLocale: string }> = {
  en: {
    title: "Nabeeh - Smart Teaching Assistant for Tutors",
    description:
      "Bilingual (AR/EN) teaching assistant with WhatsApp bot for student management, attendance tracking, and automated parent communication.",
    ogLocale: "en_US",
  },
  ar: {
    title: "نبيه - مساعد تعليمي ذكي للمعلمين",
    description:
      "مساعد تعليمي ثنائي اللغة (عربي/إنجليزي) مع بوت واتساب لإدارة الطلاب وتتبع الحضور والتواصل الآلي مع أولياء الأمور.",
    ogLocale: "ar_EG",
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const meta = localeNames[locale] || localeNames.en;

  return {
    title: meta.title,
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.description,
      locale: meta.ogLocale,
      url: `https://nabeeh.app/${locale}`,
    },
    twitter: {
      title: meta.title,
      description: meta.description,
    },
    alternates: {
      canonical: `https://nabeeh.app/${locale}`,
      languages: {
        en: "https://nabeeh.app/en",
        ar: "https://nabeeh.app/ar",
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params
}: Props) {
  const { locale } = await params;
  
  // Validate locale
  if (locale !== 'en' && locale !== 'ar') {
    notFound();
  }
  
  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <QueryProvider>
        <LocaleProvider>
          <AuthProvider>
            {children}
            <CookieNotice />
          </AuthProvider>
        </LocaleProvider>
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
