import type { Metadata } from "next";
import Link from "next/link";
import { LandingNav } from "@/components/landing/LandingNav";
import { Footer } from "@/components/landing/Footer";
import { setRequestLocale, getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const titles: Record<string, string> = {
    en: "Terms of Service - Nabeeh",
    ar: "شروط الخدمة - نبيه",
  };
  const descriptions: Record<string, string> = {
    en: "Nabeeh terms of service. Read the rules and guidelines for using our smart teaching assistant platform.",
    ar: "شروط خدمة نبيه. اقرأ القواعد والإرشادات لاستخدام منصتنا التعليمية الذكية.",
  };
  return {
    title: titles[locale] || titles.en,
    description: descriptions[locale] || descriptions.en,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `https://nabeeh.app/${locale}/terms`,
      languages: { en: "https://nabeeh.app/en/terms", ar: "https://nabeeh.app/ar/terms" },
    },
  };
}

export default async function TermsOfService({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "terms" });
  const s = (key: string, params?: Record<string, string | number>) =>
    t(`sections.${key}` as Parameters<typeof t>[0], (params ?? {}) as Parameters<typeof t>[1]);

  return (
    <div className="min-h-screen bg-canvas">
      <LandingNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h1 className="text-4xl font-bold text-ink font-display mb-2">
          {t("title")}
        </h1>
        <p className="text-sm text-ink/50 font-body mb-10">
          {t("updated")}
        </p>

        <div className="prose prose-ink max-w-none font-body space space-y-8 text-ink/80 leading-relaxed">
          <Section title={s("s1Title")}>
            <p>{s("s1Body")}</p>
          </Section>

          <Section title={s("s2Title")}>
            <p>{s("s2Body")}</p>
          </Section>

          <Section title={s("s3Title")}>
            <ul className="list-disc ps-6 space space-y-1">
              <li>{s("s3Item1")}</li>
              <li>{s("s3Item2")}</li>
              <li>{s("s3Item3")}</li>
              <li>{s("s3Item4")}</li>
            </ul>
          </Section>

          <Section title={s("s4Title")}>
            <p>{s("s4Intro")}</p>
            <ul className="list-disc ps-6 space space-y-1">
              <li>{s("s4Item1")}</li>
              <li>{s("s4Item2")}</li>
              <li>{s("s4Item3")}</li>
              <li>{s("s4Item4")}</li>
            </ul>
          </Section>

          <Section title={s("s5Title")}>
            <ul className="list-disc ps-6 space space-y-1">
              <li>{s("s5Item1")}</li>
              <li>{s("s5Item2")}</li>
              <li>{s("s5Item3")}</li>
            </ul>
          </Section>

          <Section title={s("s6Title")}>
            <ul className="list-disc ps-6 space space-y-1">
              <li>{s("s6Item1")}</li>
              <li>{s("s6Item2")}</li>
              <li>{s("s6Item3")}</li>
            </ul>
          </Section>

          <Section title={s("s7Title")}>
            <p>{s("s7Body")}</p>
          </Section>

          <Section title={s("s8Title")}>
            <p>{s("s8Body")}</p>
          </Section>

          <Section title={s("s9Title")}>
            <p>{s("s9Body")}</p>
          </Section>

          <Section title={s("s10Title")}>
            <ul className="list-disc ps-6 space space-y-1">
              <li>{s("s10Item1")}</li>
              <li>{s("s10Item2")}</li>
              <li>{s("s10Item3")}</li>
            </ul>
          </Section>

          <Section title={s("s11Title")}>
            <p>{s("s11Body")}</p>
          </Section>

          <Section title={s("s12Title")}>
            <p>{s("s12Body")}</p>
          </Section>

          <Section title={s("s13Title")}>
            <p>{s("s13Intro")}</p>
            <ul className="list-disc ps-6 space space-y-1">
              <li>
                {s("s13EmailLabel")}{" "}
                <a href="mailto:hello@nabeeh.app" className="text-primary hover:underline">
                  hello@nabeeh.app
                </a>
              </li>
              <li>
                {s("s13WhatsAppLabel")}{" "}
                <a href="https://wa.me/201234567890" className="text-primary hover:underline">
                  {s("s13WhatsAppLink")}
                </a>
              </li>
            </ul>
          </Section>
        </div>

        <div className="mt-12 pt-8 border-t border-ink/10">
          <Link
            href={`/${locale}`}
            className="text-primary hover:text-primary/80 font-body font-medium"
          >
            {t("backHome")}
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-ink font-display mb-3">{title}</h2>
      <div>{children}</div>
    </div>
  );
}