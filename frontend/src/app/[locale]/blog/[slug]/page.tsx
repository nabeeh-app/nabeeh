import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
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

export default async function BlogPost({ params }: Props) {
  const { locale, slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();

  const isAr = locale === 'ar';
  const content = isAr ? post.ar : post.en;

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
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <nav className="text-sm text-ink/50 mb-8 font-body">
          <Link href={`/${locale}`} className="hover:text-ink transition-colors">
            {isAr ? 'الرئيسية' : 'Home'}
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/${locale}/blog`} className="hover:text-ink transition-colors">
            {isAr ? 'المدونة' : 'Blog'}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink truncate">{content.title}</span>
        </nav>

        <header className="mb-12">
          <time className="text-sm text-ink/50 font-body">{post.date}</time>
          <h1 className="text-3xl sm:text-4xl font-bold text-ink font-display mt-3 mb-6 leading-tight">
            {content.title}
          </h1>
          <p className="text-lg text-ink/70 font-body leading-relaxed">
            {content.excerpt}
          </p>
        </header>

        <div
          className="prose prose-lg max-w-none text-ink/80 font-body leading-relaxed
            prose-headings:font-display prose-headings:text-ink
            prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
            prose-p:mb-4
            prose-li:mb-2
            prose-strong:text-ink
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline"
          dangerouslySetInnerHTML={{ __html: content.content }}
        />

        <div className="mt-16 pt-8 border-t border-ink/10">
          <Link
            href={`/${locale}/blog`}
            className="text-primary font-body font-medium hover:underline"
          >
            &larr; {isAr ? 'العودة للمدونة' : 'Back to blog'}
          </Link>
        </div>
      </article>
    </div>
  );
}
