import type { Metadata } from 'next';
import Link from 'next/link';
import {
  CheckCircle,
  BarChart3,
  MessageCircle,
  Send,
  PieChart,
  Users,
  Shield,
  Globe,
  Zap,
  Calendar,
  FileText,
  Bell,
} from 'lucide-react';

type Props = { params: Promise<{ locale: string }> };

const seo: Record<string, { title: string; description: string }> = {
  en: {
    title: 'Features - Attendance, Grades, WhatsApp Bot for Tutors',
    description:
      'Explore Nabeeh features: automated attendance tracking, grade management, WhatsApp bot for parent communication, performance reports, and multi-group scheduling for tutors.',
  },
  ar: {
    title: 'المميزات - تتبع الحضور والدرجات وبوت الواتساب للمعلمين',
    description:
      'اكتشف مميزات نبيه: تتبع الحضور التلقائي، إدارة الدرجات، بوت واتساب للتواصل مع أولياء الأمور، التقارير، وإدارة المجموعات المتعددة.',
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const m = seo[locale] || seo.en;
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: `https://nabeeh.app/${locale}/features` },
    openGraph: { title: m.title, description: m.description },
  };
}

const featureList = [
  {
    icon: CheckCircle,
    en: { title: 'Attendance Tracking', desc: 'Mark attendance in seconds with bulk entry. Track patterns, identify at-risk students, and generate attendance reports automatically.' },
    ar: { title: 'تتبع الحضور', desc: 'سجّل الحضور في ثوانٍ بال录入 الجماعي. تتبع الأنماط، حدد الطلاب المعرضين للخطر، وتولّد تقارير الحضور تلقائياً.' },
  },
  {
    icon: BarChart3,
    en: { title: 'Grade Management', desc: 'Support for quizzes, midterms, finals, homework, and projects. Enter scores, calculate averages, and generate grade reports.' },
    ar: { title: 'إدارة الدرجات', desc: 'دعم الكويزات والامتحانات والواجبات والمشاريع. أدخل الدرجات، احسب المتوسطات، وتولّد تقارير الدرجات.' },
  },
  {
    icon: MessageCircle,
    en: { title: 'WhatsApp Bot', desc: 'Parents ask about attendance, grades, or schedule on WhatsApp. Nabeeh responds automatically in under 5 seconds.' },
    ar: { title: 'بوت الواتساب', desc: 'أولياء الأمور بيسألوا عن الحضور والدرجات والجدول على الواتساب. نبيه بيرد تلقائياً في أقل من 5 ثواني.' },
  },
  {
    icon: Send,
    en: { title: 'Parent Communication', desc: 'Send updates, reports, and announcements to parents directly through WhatsApp in Arabic or English.' },
    ar: { title: 'التواصل مع أولياء الأمور', desc: 'ابعت تحديثات وتقارير وإعلانات لأولياء الأمور مباشرة عبر الواتساب بالعربي أو الإنجليزي.' },
  },
  {
    icon: PieChart,
    en: { title: 'Performance Reports', desc: 'Visual dashboards showing student progress, attendance trends, and grade distributions. AI-generated report comments.' },
    ar: { title: 'تقارير الأداء', desc: 'لوحات تحكم بصرية توضح تقدم الطلاب واتجاهات الحضور وتوزيع الدرجات. تعليقات تقارير بالذكاء الاصطناعي.' },
  },
  {
    icon: Users,
    en: { title: 'Multi-Group Management', desc: 'Manage multiple classes, subjects, and student groups from a single dashboard with scheduling and capacity limits.' },
    ar: { title: 'إدارة المجموعات المتعددة', desc: 'ادرس فصول ومقررات ومجموعات طلاب متعددة من لوحة تحكم واحدة مع جدولة وحدود سعة.' },
  },
  {
    icon: Shield,
    en: { title: 'Data Security', desc: 'Enterprise-grade security with Supabase (PostgreSQL), JWT authentication, encrypted storage, and Row Level Security.' },
    ar: { title: 'أمان البيانات', desc: 'أمان على مستوى المؤسسات مع Supabase، مصادقة JWT، تخزين مشفر، وأمان على مستوى الصفوف.' },
  },
  {
    icon: Globe,
    en: { title: 'Bilingual Support', desc: 'Full Arabic and English interface. Switch languages anytime. WhatsApp bot responds in both languages.' },
    ar: { title: 'دعم ثنائي اللغة', desc: 'واجهة عربية وإنجليزية كاملة. غيّر اللغة في أي وقت. بوت الواتساب بيرد باللغتين.' },
  },
  {
    icon: Zap,
    en: { title: 'Quick Setup', desc: 'Get started in under 5 minutes. Add students, create groups, and start tracking. No technical knowledge required.' },
    ar: { title: 'إعداد سريع', desc: 'ابدأ في أقل من 5 دقايق. أضف الطلاب، أنشئ مجموعات، وابدأ التتبع. محتاج أي خبرة تقنية.' },
  },
  {
    icon: Calendar,
    en: { title: 'Schedule Management', desc: 'Organize classes by day and time. Parents and students can view upcoming sessions.' },
    ar: { title: 'إدارة الجداول', desc: 'نظّم الحصص حسب اليوم والوقت. أولياء الأمور والطلاب يقدروا يشوفوا الجلسات الجاية.' },
  },
  {
    icon: FileText,
    en: { title: 'Assessment Types', desc: 'Quizzes, tests, exams, assignments, projects, participation, homework, midterms, and finals. All supported.' },
    ar: { title: 'أنواع التقييم', desc: 'كويزات، اختبارات، امتحانات، واجبات، مشاركات، ميدتيرم، ونهائي. كلهم مدعومين.' },
  },
  {
    icon: Bell,
    en: { title: 'Smart Alerts', desc: 'Configure alerts for low attendance, missing grades, or parent messages. Never miss an important update.' },
    ar: { title: 'تنبيهات ذكية', desc: 'عرّف تنبيهات للحضور المنخفض أو الدرجات الناقصة أو رسائل أولياء الأمور. متغبش على أي تحديث مهم.' },
  },
];

const ui = {
  en: { home: 'Home', page: 'Features', heading: 'Nabeeh Features', subtitle: 'Nabeeh combines everything you need to manage your classes in one place: attendance, grades, WhatsApp, and parent communication.', ctaTitle: 'Try Nabeeh for Free', ctaDesc: 'Start in minutes, no credit card required.', ctaBtn: 'Get Started Free' },
  ar: { home: 'الرئيسية', page: 'المميزات', heading: 'مميزات نبيه', subtitle: 'نبيه بيجمع كل اللي محتاجه لإدارة فصولك في مكان واحد: حضور، درجات، واتساب، وتواصل مع أولياء الأمور.', ctaTitle: 'جرب نبيه ببلاش', ctaDesc: 'ابدأ في دقايق، محتاج أي بطاقة ائتمان.', ctaBtn: 'إنشاء حساب مجاني' },
};

export default async function FeaturesPage({ params }: Props) {
  const { locale } = await params;
  const isAr = locale === 'ar';
  const t = isAr ? ui.ar : ui.en;

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <nav className="text-sm text-ink/50 mb-8 font-body">
          <Link href={`/${locale}`} className="hover:text-ink transition-colors">
            {t.home}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink">{t.page}</span>
        </nav>

        <header className="mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold text-ink font-display mb-6">
            {t.heading}
          </h1>
          <p className="text-lg text-ink/70 font-body max-w-2xl leading-relaxed">
            {t.subtitle}
          </p>
        </header>

        <div className="grid sm:grid-cols-2 gap-8">
          {featureList.map((f) => (
            <article
              key={f.en.title}
              className="bg-surface border border-ink/10 rounded-xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-ink font-display">
                  {isAr ? f.ar.title : f.en.title}
                </h2>
              </div>
              <p className="text-ink/70 font-body leading-relaxed">
                {isAr ? f.ar.desc : f.en.desc}
              </p>
            </article>
          ))}
        </div>

        <section className="mt-20 text-center">
          <h2 className="text-2xl font-bold text-ink font-display mb-4">
            {t.ctaTitle}
          </h2>
          <p className="text-ink/70 font-body mb-6">{t.ctaDesc}</p>
          <Link
            href={`/${locale}/register`}
            className="inline-block px-8 py-3 bg-primary text-white rounded-lg font-body font-medium hover:bg-primary/90 transition-colors"
          >
            {t.ctaBtn}
          </Link>
        </section>
      </div>
    </div>
  );
}
