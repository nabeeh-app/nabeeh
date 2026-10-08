import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LandingNav } from '@/components/landing/LandingNav';
import { Footer } from '@/components/landing/Footer';
import { AttendanceTool } from './AttendanceTool';

type Props = { params: Promise<{ locale: string }> };

const seo = {
  en: {
    title: 'Free Student Attendance Sheet Generator (Excel & PDF)',
    description:
      'Generate a printable monthly student attendance sheet in seconds. Exclude Fridays or weekends, mark present/absent/late, flag at-risk students, and download as Excel or print to PDF. Free, no signup.',
  },
  ar: {
    title: 'مولد كشف حضور وغياب الطلاب مجاناً (Excel وPDF)',
    description:
      'اعمل كشف حضور وغياب شهري للطلاب في ثواني. استبعد الجمعة والسبت، سجل حاضر وغائب ومتأخر، وحدد الطلاب المعرضين للإنذار، وحمّل Excel أو اطبع PDF. مجاني وبدون تسجيل.',
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const m = locale === 'ar' ? seo.ar : seo.en;
  const path = `/${locale}/tools/attendance-sheet`;
  return {
    title: m.title,
    description: m.description,
    alternates: {
      canonical: `https://nabeeh.app${path}`,
      languages: {
        en: 'https://nabeeh.app/en/tools/attendance-sheet',
        ar: 'https://nabeeh.app/ar/tools/attendance-sheet',
        'x-default': 'https://nabeeh.app/ar/tools/attendance-sheet',
      },
    },
    openGraph: {
      type: 'article',
      title: m.title,
      description: m.description,
      url: `https://nabeeh.app${path}`,
      siteName: 'Nabeeh',
    },
    twitter: { card: 'summary_large_image', title: m.title, description: m.description },
  };
}

export default async function AttendanceSheetPage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'tools.attendance' });
  const rtl = locale === 'ar';

  const faqs = [1, 2, 3, 4].map((n) => ({
    question: t(`q${n}`),
    answer: t(`a${n}`),
  }));

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: locale === 'ar' ? 'ar-EG' : 'en',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  const howJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: t('howTitle'),
    step: [1, 2, 3].map((n) => ({
      '@type': 'HowToStep',
      name: t(`step${n}t`),
      text: t(`step${n}d`),
    })),
  };

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className="min-h-screen bg-canvas">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howJsonLd) }}
      />
      <div className="no-print">
        <LandingNav />
      </div>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <nav aria-label="Breadcrumb" className="no-print text-xs text-ink/50 mb-4">
          <Link href={`/${locale}`} className="hover:underline">
            {locale === 'ar' ? 'الرئيسية' : 'Home'}
          </Link>
          <span className="mx-1">/</span>
          <span>{locale === 'ar' ? 'أدوات مجانية' : 'Free tools'}</span>
        </nav>

        <h1 className="font-display font-bold text-3xl sm:text-4xl text-ink">
          {locale === 'ar'
            ? 'مولد كشف حضور وغياب الطلاب'
            : 'Student Attendance Sheet Generator'}
        </h1>
        <p className="mt-3 text-ink/60 max-w-2xl">
          {locale === 'ar'
            ? 'كشف شهري جاهز للطباعة والتحميل: دخل الأسماء، علم على الحضور، وحمّل Excel أو اطبع PDF. مجاني وبدون تسجيل.'
            : 'A monthly sheet ready to print and download: enter names, mark attendance, and get Excel or print to PDF. Free, no signup.'}
        </p>

        <div className="mt-6">
          <AttendanceTool />
        </div>

        <section className="no-print mt-12 grid sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-xl border border-ink/10 p-5">
              <div className="font-display font-bold text-primary text-sm">0{n}</div>
              <h2 className="font-display font-bold mt-1">{t(`step${n}t`)}</h2>
              <p className="text-sm text-ink/60 mt-1">{t(`step${n}d`)}</p>
            </div>
          ))}
        </section>

        <section className="no-print mt-8">
          <h2 className="font-display font-bold text-xl">{t('faqTitle')}</h2>
          <div className="mt-3 space-y-3">
            {faqs.map((f, i) => (
              <details key={i} className="rounded-xl border border-ink/10 p-4">
                <summary className="font-semibold cursor-pointer">{f.question}</summary>
                <p className="text-sm text-ink/60 mt-2">{f.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="no-print mt-8 rounded-2xl bg-ink text-canvas p-6 sm:p-8 text-center">
          <h2 className="font-display font-bold text-2xl">{t('ctaTitle')}</h2>
          <p className="mt-2 text-canvas/70 max-w-xl mx-auto text-sm sm:text-base">
            {t('ctaDesc')}
          </p>
          <Link
            href={`/${locale}/register`}
            className="inline-block mt-4 h-11 px-6 rounded-md bg-primary text-white font-medium leading-11"
          >
            {t('ctaBtn')}
          </Link>
        </section>
      </main>
      <div className="no-print">
        <Footer />
      </div>
    </div>
  );
}
