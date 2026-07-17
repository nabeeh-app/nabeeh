import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Mail,
  MessageCircle,
  AlertTriangle,
  CheckCircle,
  Clock,
  Zap,
  Smartphone,
  Globe,
  Database,
  Shield,
} from 'lucide-react';

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
}

const content = {
  en: {
    home: 'Home',
    about: 'About',
    heroLabel: 'ABOUT NABEEH',
    hero: 'Built for Tutors Who Care',
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
    techLabel: 'TECHNOLOGY',
    techTitle: 'Built on Modern Tech',
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
    heroLabel: 'عن نبيه',
    hero: 'اتبنى للمدرسين اللي بيهتموا',
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
    techLabel: 'التقنية',
    techTitle: 'مبنية على أحدث التقنيات',
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
  { value: '5+', en: 'Hours saved per week', ar: 'ساعات توفرها أسبوعياً', icon: Clock },
  { value: '5 min', en: 'Setup time', ar: 'وقت الإعداد', icon: Zap },
  { value: '< 5s', en: 'Bot response time', ar: 'زمن رد البوت', icon: Smartphone },
];

const techStack = [
  { en: 'Next.js', ar: 'Next.js', desc_en: 'Modern React framework', desc_ar: 'واجهة React حديثة', icon: Globe },
  { en: 'Express', ar: 'Express', desc_en: 'Fast API layer', desc_ar: 'طبقة API سريعة', icon: Zap },
  { en: 'Supabase', ar: 'Supabase', desc_en: 'PostgreSQL database', desc_ar: 'قاعدة بيانات PostgreSQL', icon: Database },
  { en: 'Baileys', ar: 'Baileys', desc_en: 'WhatsApp integration', desc_ar: 'ربط الواتساب', icon: MessageCircle },
];

export default async function AboutPage({ params }: Props) {
  const { locale } = await params;
  const isAr = locale === 'ar';
  const c = isAr ? content.ar : content.en;
  const phone = '201234567890';
  const emailAddr = 'hello@nabeeh.app';

  return (
    <div className="min-h-screen bg-canvas">
      {/* Hero Band — deep teal */}
      <section className="bg-ink text-canvas">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <nav className="text-sm text-canvas/40 mb-8 font-mono uppercase tracking-wider">
            <Link href={`/${locale}`} className="hover:text-canvas transition-colors">
              {c.home}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-canvas/70">{c.about}</span>
          </nav>

          <p className="font-mono text-sm uppercase tracking-wider text-accent mb-4">
            {c.heroLabel}
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-canvas font-display mb-6 leading-tight">
            {c.hero}
          </h1>
          <p className="text-lg text-canvas/70 font-body max-w-2xl leading-relaxed">
            {c.heroDesc}
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Problem & Solution — side by side */}
        <section className="py-16 lg:py-20">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-destructive/5 border border-destructive/10 rounded-xl p-8">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold text-ink font-display mb-4">
                {c.problemTitle}
              </h2>
              <div className="text-ink/70 font-body leading-relaxed space-y-3">
                <p>{c.problem1}</p>
                <p>{c.problem2}</p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/10 rounded-xl p-8">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-2xl font-bold text-ink font-display mb-4">
                {c.solutionTitle}
              </h2>
              <div className="text-ink/70 font-body leading-relaxed space-y-3">
                <p>{c.solution1}</p>
                <p>{c.solution2}</p>
              </div>
            </div>
          </div>
        </section>

        {/* By the Numbers */}
        <section className="pb-16 lg:pb-20">
          <h2 className="text-2xl font-bold text-ink font-display mb-8">
            {c.numbersTitle}
          </h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {numbers.map((s) => (
              <div
                key={s.value}
                className="bg-surface-sage p-5 rounded-md"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                    <s.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink/50 truncate font-body uppercase tracking-wider">
                      {isAr ? s.ar : s.en}
                    </p>
                    <p className="text-3xl font-bold text-ink font-display leading-tight">
                      {s.value}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Technology */}
        <section className="pb-16 lg:pb-20">
          <p className="font-mono text-sm uppercase tracking-wider text-ink/40 mb-3">
            {c.techLabel}
          </p>
          <h2 className="text-2xl font-bold text-ink font-display mb-4">
            {c.techTitle}
          </h2>
          <p className="text-ink/70 font-body leading-relaxed mb-8 max-w-2xl">
            {c.techDesc}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {techStack.map((t) => (
              <div
                key={t.en}
                className="bg-surface-cool border border-ink/5 rounded-lg p-5 text-center"
              >
                <div className="w-10 h-10 rounded-full bg-canvas border border-ink/10 flex items-center justify-center mx-auto mb-3">
                  <t.icon className="w-5 h-5 text-primary" />
                </div>
                <p className="font-bold text-ink font-display text-sm">{t.en}</p>
                <p className="text-xs text-ink/50 font-body mt-1">
                  {isAr ? t.desc_ar : t.desc_en}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="pb-16 lg:pb-20">
          <h2 className="text-2xl font-bold text-ink font-display mb-6">
            {c.contactTitle}
          </h2>
          <div className="flex flex-wrap gap-4">
            <a
              href={`https://wa.me/${phone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-ink rounded-lg font-body font-medium hover:bg-accent/90 transition-colors"
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

        {/* CTA Section */}
        <section className="pb-16 lg:pb-20">
          <div className="bg-ink text-canvas rounded-xl p-10 text-center">
            <h2 className="text-2xl font-bold font-display mb-3">
              {c.tryFree}
            </h2>
            <p className="text-canvas/60 font-body mb-6">{c.tryFreeDesc}</p>
            <Link
              href={`/${locale}/register`}
              className="inline-block px-8 py-3 bg-accent text-ink rounded-lg font-body font-medium hover:bg-accent/90 transition-colors"
            >
              {c.getStarted}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
