import Link from 'next/link';
import { posts } from '@/lib/blog-data';

type Props = { params: Promise<{ locale: string }> };

export default async function BlogIndex({ params }: Props) {
  const { locale } = await params;
  const isAr = locale === 'ar';

  return (
    <div className="min-h-screen bg-canvas">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <nav className="text-sm text-ink/50 mb-8 font-body">
          <Link href={`/${locale}`} className="hover:text-ink transition-colors">
            {isAr ? 'الرئيسية' : 'Home'}
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink">{isAr ? 'المدونة' : 'Blog'}</span>
        </nav>

        <header className="mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-ink font-display mb-4">
            {isAr ? 'المدونة' : 'Blog'}
          </h1>
          <p className="text-lg text-ink/70 font-body">
            {isAr
              ? 'نصائح عملية للمدرسين الخواص: تتبع الحضور، إدارة الدرجات، التواصل مع أولياء الأمور، وتنمية بزنس الدروس.'
              : 'Practical guides for private tutors: attendance tracking, grade management, parent communication, and growing your tutoring business.'}
          </p>
        </header>

        <div className="space-y-8">
          {posts.map((post) => (
            <article
              key={post.slug}
              className="bg-surface border border-ink/10 rounded-xl p-6 hover:border-ink/20 transition-colors"
            >
              <time className="text-sm text-ink/50 font-body">{post.date}</time>
              <h2 className="text-xl font-bold text-ink font-display mt-2 mb-3">
                <Link
                  href={`/${locale}/blog/${post.slug}`}
                  className="hover:text-primary transition-colors"
                >
                  {isAr ? post.ar.title : post.en.title}
                </Link>
              </h2>
              <p className="text-ink/70 font-body leading-relaxed mb-4">
                {isAr ? post.ar.excerpt : post.en.excerpt}
              </p>
              <Link
                href={`/${locale}/blog/${post.slug}`}
                className="text-primary font-body font-medium hover:underline"
              >
                {isAr ? 'اقرأ المزيد' : 'Read more'} &rarr;
              </Link>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
