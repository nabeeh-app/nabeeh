import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock, ArrowLeft, ArrowRight } from 'lucide-react';
import { posts } from '@/lib/blog-data';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) return {};
  const content = locale === 'ar' ? post.ar : post.en;
  return {
    title: content.title,
    description: content.excerpt,
    alternates: { canonical: `https://nabeeh.app/${locale}/blog/${slug}` },
    openGraph: { title: content.title, description: content.excerpt, type: 'article', publishedTime: post.date },
  };
}

function estimateReadingTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, '');
  const words = text.split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export default async function BlogPost({ params }: Props) {
  const { locale, slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();

  const isAr = locale === 'ar';
  const content = isAr ? post.ar : post.en;
  const readingTime = estimateReadingTime(content.content);

  const related = posts
    .filter((p) => p.slug !== slug)
    .slice(0, 2);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: content.title,
    description: content.excerpt,
    datePublished: post.date,
    author: { '@type': 'Organization', name: 'Nabeeh' },
    publisher: { '@type': 'Organization', name: 'Nabeeh' },
    mainEntityOfPage: `https://nabeeh.app/${locale}/blog/${slug}`,
  };

  return (
    <div className="min-h-screen bg-canvas">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero Band */}
      <section className="bg-ink text-canvas">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <nav className="text-sm text-canvas/40 mb-8 font-body uppercase tracking-wider">
            <Link href={`/${locale}`} className="hover:text-canvas transition-colors">
              {isAr ? 'الرئيسية' : 'Home'}
            </Link>
            <span className="mx-2">/</span>
            <Link href={`/${locale}/blog`} className="hover:text-canvas transition-colors">
              {isAr ? 'المدونة' : 'Blog'}
            </Link>
            <span className="mx-2">/</span>
            <span className="text-canvas/70 truncate">{content.title}</span>
          </nav>

          <div className="flex items-center gap-3 mb-4">
            <time className="font-body text-xs uppercase tracking-wider text-canvas/50">
              {post.date}
            </time>
            <span className="text-canvas/20">·</span>
            <span className="inline-flex items-center gap-1 font-body text-xs uppercase tracking-wider text-canvas/50">
              <Clock className="w-3 h-3" />
              {readingTime} {isAr ? 'دقيقة قراءة' : 'min read'}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-canvas font-display mt-3 mb-6 leading-tight">
            {content.title}
          </h1>
          <p className="text-lg text-canvas/70 font-body leading-relaxed max-w-2xl">
            {content.excerpt}
          </p>
        </div>
      </section>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Article Content */}
        <div
          className="prose prose-lg max-w-none text-ink/80 font-body leading-relaxed
            prose-headings:font-display prose-headings:text-ink
            prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:leading-tight
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:mb-4 prose-p:leading-relaxed
            prose-li:mb-2
            prose-strong:text-ink
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-ul:my-4
            prose-ol:my-4"
          dangerouslySetInnerHTML={{ __html: content.content }}
        />

        {/* Back to blog */}
        <div className="mt-16 pt-8 border-t border-ink/10">
          <Link
            href={`/${locale}/blog`}
            className="inline-flex items-center gap-2 text-primary font-body font-medium hover:gap-3 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            {isAr ? 'العودة للمدونة' : 'Back to blog'}
          </Link>
        </div>

        {/* Related Posts */}
        {related.length > 0 && (
          <section className="mt-16 pt-8 border-t border-ink/10">
            <p className="font-body text-sm uppercase tracking-wider text-ink/40 mb-3">
              {isAr ? 'مقالات ذات صلة' : 'RELATED POSTS'}
            </p>
            <h2 className="text-2xl font-bold text-ink font-display mb-8">
              {isAr ? 'اقرأ أيضاً' : 'Read More'}
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {related.map((r) => {
                const rContent = isAr ? r.ar : r.en;
                return (
                  <Link
                    key={r.slug}
                    href={`/${locale}/blog/${r.slug}`}
                    className="group bg-surface-sage border border-ink/5 rounded-xl p-6 hover:border-ink/10 transition-colors"
                  >
                    <time className="font-body text-xs uppercase tracking-wider text-ink/40">
                      {r.date}
                    </time>
                    <h3 className="text-lg font-bold text-ink font-display mt-2 mb-2 group-hover:text-primary transition-colors leading-snug">
                      {rContent.title}
                    </h3>
                    <p className="text-sm text-ink/70 font-body leading-relaxed line-clamp-2">
                      {rContent.excerpt}
                    </p>
                    <span className="inline-flex items-center gap-2 text-primary font-body font-medium text-sm mt-3 group-hover:gap-3 transition-all">
                      {isAr ? 'اقرأ المزيد' : 'Read more'}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
