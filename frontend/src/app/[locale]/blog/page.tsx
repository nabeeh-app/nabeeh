import type { Metadata } from 'next';
import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';
import { posts } from '@/lib/blog-data';

type Props = { params: Promise<{ locale: string }> };

const seo: Record<string, { title: string; description: string }> = {
  en: {
    title: 'Blog - Tutoring Tips, Attendance & Grade Management',
    description:
      'Practical guides for private tutors: attendance tracking, grade management, parent communication, WhatsApp automation, and growing your tutoring business.',
  },
  ar: {
    title: 'المدونة - نصائح الدروس الخصوصية وإدارة الحضور والدرجات',
    description:
      'أدلة عملية للمدرسين الخواص: تتبع الحضور، إدارة الدرجات، التواصل مع أولياء الأمور، أتمتة الواتساب، وتنمية بزنس الدروس.',
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const m = seo[locale] || seo.en;
  return {
    title: m.title,
    description: m.description,
    alternates: { canonical: `https://nabeeh.app/${locale}/blog` },
    openGraph: { title: m.title, description: m.description },
  };
}

function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, '');
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export default async function BlogIndex({ params }: Props) {
  const { locale } = await params;
  const isAr = locale === 'ar';
  const [featured, ...rest] = posts;

  return (
    <div className="min-h-screen bg-canvas">
      {/* Hero Band */}
      <section className="bg-ink text-canvas">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <nav className="text-sm text-canvas/40 mb-8 font-mono uppercase tracking-wider">
            <Link href={`/${locale}`} className="hover:text-canvas transition-colors">
              {isAr ? 'الرئيسية' : 'Home'}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-canvas/70">{isAr ? 'المدونة' : 'Blog'}</span>
          </nav>

          <p className="font-mono text-sm uppercase tracking-wider text-accent mb-4">
            {isAr ? 'المدونة' : 'BLOG'}
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold text-canvas font-display mb-4 leading-tight">
            {isAr ? 'المدونة' : 'Blog'}
          </h1>
          <p className="text-lg text-canvas/70 font-body max-w-2xl leading-relaxed">
            {isAr
              ? 'نصائح عملية للمدرسين الخواص: تتبع الحضور، إدارة الدرجات، التواصل مع أولياء الأمور، وتنمية بزنس الدروس.'
              : 'Practical guides for private tutors: attendance tracking, grade management, parent communication, and growing your tutoring business.'}
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Featured Post */}
        {featured && (
          <article className="mb-12">
            <Link href={`/${locale}/blog/${featured.slug}`} className="group block">
              <div className="bg-surface-sage border border-ink/5 rounded-xl p-8 lg:p-10 hover:border-ink/10 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <span className="font-mono text-xs uppercase tracking-wider text-primary">
                    {isAr ? 'مقال مميز' : 'Featured'}
                  </span>
                  <span className="text-ink/20">·</span>
                  <time className="font-mono text-xs uppercase tracking-wider text-ink/40">
                    {featured.date}
                  </time>
                  <span className="text-ink/20">·</span>
                  <span className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-ink/40">
                    <Clock className="w-3 h-3" />
                    {estimateReadingTime(isAr ? featured.ar.content : featured.en.content)} min
                  </span>
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-ink font-display mb-4 group-hover:text-primary transition-colors leading-tight">
                  {isAr ? featured.ar.title : featured.en.title}
                </h2>
                <p className="text-ink/70 font-body leading-relaxed mb-6 max-w-3xl">
                  {isAr ? featured.ar.excerpt : featured.en.excerpt}
                </p>
                <span className="inline-flex items-center gap-2 text-primary font-body font-medium group-hover:gap-3 transition-all">
                  {isAr ? 'اقرأ المزيد' : 'Read more'}
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          </article>
        )}

        {/* Post Grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {rest.map((post) => (
            <article
              key={post.slug}
              className="group bg-surface-cool border border-ink/5 rounded-xl p-6 hover:border-ink/10 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <time className="font-mono text-xs uppercase tracking-wider text-ink/40">
                  {post.date}
                </time>
                <span className="text-ink/20">·</span>
                <span className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-ink/40">
                  <Clock className="w-3 h-3" />
                  {estimateReadingTime(isAr ? post.ar.content : post.en.content)} min
                </span>
              </div>
              <h2 className="text-xl font-bold text-ink font-display mb-3 group-hover:text-primary transition-colors leading-snug">
                <Link href={`/${locale}/blog/${post.slug}`}>
                  {isAr ? post.ar.title : post.en.title}
                </Link>
              </h2>
              <p className="text-ink/70 font-body leading-relaxed mb-4 text-sm">
                {isAr ? post.ar.excerpt : post.en.excerpt}
              </p>
              <Link
                href={`/${locale}/blog/${post.slug}`}
                className="inline-flex items-center gap-2 text-primary font-body font-medium text-sm group-hover:gap-3 transition-all"
              >
                {isAr ? 'اقرأ المزيد' : 'Read more'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
