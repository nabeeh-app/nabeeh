import type { Metadata } from 'next';
import Link from 'next/link';
import { Mail, MessageCircle } from 'lucide-react';

type Props = { params: Promise<{ locale: string }> };

const seo: Record<string, { title: string; description: string }> = {
  en: {
    title: 'About Nabeeh - Smart Teaching Assistant for Tutors',
    description:
      'Learn about Nabeeh, a bilingual teaching assistant built for private tutors and tutoring centers in Egypt. Mission, team, and contact information.',
  },
  ar: {
    title: 'عن نبيه - مساعد تعليمي ذكي للمعلمين',
    description:
      'تعرف على نبيه، المساعد التعليمي ثنائي اللغة المصمم للمعلمين وأكاديميات الدوّرس في مصر.',
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const m = seo[locale] || seo.en;
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: `https://nabeeh.app/${locale}/about` },
    openGraph: { title: m.title, description: m.description },
  };
};

const content = {
  en: {
    home: 'Home',
    about: 'About',
    hero: 'About Nabeeh',
    heroDesc:
      'Nabeeh was built to solve a real problem for private tutors in Egypt and the MENA region: managing students, attendance, and parent communication in one place.',
    problemTitle: 'The Problem',
    problem1:
      'Private tutors spend 5+ hours per week on administrative tasks: tracking attendance in spreadsheets, manually responding to parent WhatsApp messages, and calculating grades by hand.',
    problem2:
      'The result: calculation errors, delayed responses to parents, and students falling behind without the tutor noticing.',
    solutionTitle: 'Our Solution',
    solution1:
      'Nabeeh brings it all together: from attendance to grades to parent communication. The WhatsApp bot answers parent queries automatically in under 5 seconds.',
    solution2:
      'The result: tutors save 4+ hours per week, parents get instant answers, and students are tracked better.',
    numbersTitle: 'By the Numbers',
    techTitle: 'Technology',
    techDesc:
      'Nabeeh is built on modern tech: Next.js frontend, Express API, Supabase (PostgreSQL) database, and Baileys for WhatsApp integration. Enterprise-grade security with JWT authentication and encrypted data.',
    contactTitle: 'Get in Touch',
    whatsapp: 'WhatsApp',
    email: 'Email',
    tryFree: 'Try Nabeeh for Free',
    tryFreeDesc: 'Start in minutes, no credit card required.',
    getStarted: 'Get Started Free',
  },
  ar: {
    home: 'الرئيسية',
    about: 'من نحن',
    hero: 'من نحن',
    heroDesc:
      'نبيه اتعمل عشان يحل مشكلة المدرسين الخصوصيين في مصر والمنطقة العربية: إدارة الطلاب والحضور والتواصل مع أولياء الأمور في مكان واحد.',
    problemTitle: 'المشكلة',
    problem1:
      'المدرسين الخصوصيين بيقضوا 5 ساعات أو أكتر أسبوعياً في مهام إدارية: تسجيل الحضور في الإكسل، الرد يدوياً على رسائل الواتساب من أولياء الأمور، وحساب الدرجات بإيدهم.',
    problem2:
      'النتيجة: أخطاء في الحسابات، تأخر في الرد على أولياء الأمور، وطلاب بيقعوا من غير ما المدرس يحس.',
    solutionTitle: 'الحل',
    solution1:
      'نبيه بيجمع كل حاجة في مكان واحد: من الحضور للدرجات للتواصل مع أولياء الأمور. بوت الواتساب بيرد على استفسارات أولياء الأمور تلقائياً في أقل من 5 ثواني.',
    solution2:
      'النتيجة: المدرس بيوفر 4 ساعات أو أكتر أسبوعياً، أولياء الأمور بيحصلوا على رد فوري، والطلاب بيتتابعوا بشكل أفضل.',
    numbersTitle: 'بالأرقام',
    techTitle: 'التقنية',
    techDesc:
      'نبيه مبني على أحدث التقنيات: Next.js للواجهة الأمامية، Express للـ API، Supabase (PostgreSQL) لقاعدة البيانات، وBaileys لربط الواتساب. الأمان على مستوى المؤسسات مع مصادقة JWT وتشفير البيانات.',
    contactTitle: 'تواصل معانا',
    whatsapp: 'واتساب',
    email: 'البريد الإلكتروني',
    tryFree: 'جرب نبيه ببلاش',
    tryFreeDesc: 'ابدأ في دقايق، محتاج أي بطاقة ائتمان.',
    getStarted: 'إنشاء حساب مجاني',
  },
};

const numbers = [
  { value: '5+', en: 'Hours saved per week', ar: 'ساعات توفرها أسبوعياً' },
  { value: '5 min', en: 'Setup time', ar: 'وقت الإعداد' },
  { value: '< 5s', en: 'Bot response time', ar: 'زمن رد البوت' },
];

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  const isAr = locale === 'ar';
  const c = isAr ? content.ar : content.en;
  const phone = '201234567890';
  const emailAddr = 'hello@nabeeh.app';

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <nav className="text-sm text-ink/50 mb-8 font-body">
          <Link href={`/${locale}`} className="hover:text-ink transition-colors">
            {c.home}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink">{c.about}</span>
        </nav>

        <header className="mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-ink font-display mb-6">
            {c.hero}
          </h1>
          <p className="text-lg text-ink/70 font-body max-w-2xl leading-relaxed">
            {c.heroDesc}
          </p>
        </header>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-ink font-display mb-6">
            {c.problemTitle}
          </h2>
          <div className="text-ink/70 font-body leading-relaxed space-y-4">
            <p>{c.problem1}</p>
            <p>{c.problem2}</p>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-ink font-display mb-6">
            {c.solutionTitle}
          </h2>
          <div className="text-ink/70 font-body leading-relaxed space-y-4">
            <p>{c.solution1}</p>
            <p>{c.solution2}</p>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-ink font-display mb-6">
            {c.numbersTitle}
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {numbers.map((s) => (
              <div
                key={s.value}
                className="bg-surface border border-ink/10 rounded-xl p-6 text-center"
              >
                <div className="text-3xl font-bold text-primary font-display mb-2">
                  {s.value}
                </div>
                <div className="text-ink/70 font-body text-sm">
                  {isAr ? s.ar : s.en}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-ink font-display mb-6">
            {c.techTitle}
          </h2>
          <div className="text-ink/70 font-body leading-relaxed">
            <p>{c.techDesc}</p>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-bold text-ink font-display mb-6">
            {c.contactTitle}
          </h2>
          <div className="flex flex-wrap gap-4">
            <a
              href={`https://wa.me/${phone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-body font-medium hover:bg-primary/90 transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              {c.whatsapp}
            </a>
            <a
              href={`mailto:${emailAddr}`}
              className="inline-flex items-center gap-2 px-6 py-3 border border-ink/20 text-ink rounded-lg font-body font-medium hover:bg-ink/5 transition-colors"
            >
              <Mail className="w-5 h-5" />
              {c.email}
            </a>
          </div>
        </section>

        <section className="text-center py-12 border-t border-ink/10">
          <h2 className="text-2xl font-bold text-ink font-display mb-4">
            {c.tryFree}
          </h2>
          <p className="text-ink/70 font-body mb-6">{c.tryFreeDesc}</p>
          <Link
            href={`/${locale}/register`}
            className="inline-block px-8 py-3 bg-primary text-white rounded-lg font-body font-medium hover:bg-primary/90 transition-colors"
          >
            {c.getStarted}
          </Link>
        </section>
      </div>
    </div>
  );
}
