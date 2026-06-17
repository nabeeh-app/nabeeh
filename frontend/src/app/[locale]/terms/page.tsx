import type { Metadata } from "next";
import Link from "next/link";
import { LandingNav } from "@/components/landing/LandingNav";
import { Footer } from "@/components/landing/Footer";

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
  const isAr = locale === "ar";

  return (
    <div className="min-h-screen bg-canvas">
      <LandingNav />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h1 className="text-4xl font-bold text-ink font-display mb-2">
          {isAr ? "شروط الخدمة" : "Terms of Service"}
        </h1>
        <p className="text-sm text-ink/50 font-body mb-10">
          {isAr ? "آخر تحديث: يونيو 2026" : "Last updated: June 2026"}
        </p>

        <div className="prose prose-ink max-w-none font-body space-y-8 text-ink/80 leading-relaxed">
          {isAr ? (
            <>
              <Section title="1. القبول بالشروط">
                <p>
                  بالوصول إلى نظام نبيه (&quot;الخدمة&quot;) أو استخدامه، فإنك توافق على الالتزام بهذه الشروط والأحكام. إذا كنت لا توافق على أي شروط، يُرجى عدم استخدام الخدمة.
                </p>
              </Section>

              <Section title="2. وصف الخدمة">
                <p>
                  نبيه هو مساعد تعليمي ذكي يعمل عبر الويب ويقدم إدارة الطلاب، وتتبع الحضور، وإدارة الدرجات، والتواصل الآلي مع أولياء الأمور عبر واتساب.
                </p>
              </Section>

              <Section title="3. الحسابات">
                <ul className="list-disc pl-6 space-y-1">
                  <li>يجب أن يكون عمرك 18 عامًا على الأقل لإنشاء حساب</li>
                  <li>أنت مسؤول عن الحفاظ على سرية بيانات اعتماد حسابك</li>
                  <li>أنت مسؤول عن جميع الأنشطة التي تحدث تحت حسابك</li>
                  <li>يجب إخطارنا فورًا بأي استخدام غير مصرح به لحسابك</li>
                </ul>
              </Section>

              <Section title="4. استخدام الخدمة">
                <p>توافق على:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>استخدام الخدمة فقط للأغراض التعليمية المشروعة</li>
                  <li>عدم مشاركة بيانات حسابك مع أطراف ثالثة</li>
                  <li>عدم محاولة الوصول غير المصرح به إلى النظام</li>
                  <li>عدم استخدام الخدمة لأي غرض غير قانوني</li>
                </ul>
              </Section>

              <Section title="5. بيانات الطلاب وأولياء الأمور">
                <ul className="list-disc pl-6 space-y-1">
                  <li>أنت مسؤول عن الحصول على موافقة أولياء الأمور على جمع بيانات أطفالهم</li>
                  <li>أنت مسؤول عن دقة البيانات المدخلة</li>
                  <li>نملأ حماية بيانات الطلاب وفقًا لقانون حماية البيانات الشخصية المصري</li>
                </ul>
              </Section>

              <Section title="6. الأسعار والدفع">
                <ul className="list-disc pl-6 space-y-1">
                  <li>الخدمة مجانية للمستخدمين الفرديين (حتى 20 طالبًا)</li>
                  <li>الخطط المدفوعة ستكون متاحة في المستقبل</li>
                  <li>نحتفظ بالحق في تعديل الأسعار بإشعار مسبق</li>
                </ul>
              </Section>

              <Section title="7. الملكية الفكرية">
                <p>
                  جميع محتويات الخدمة، بما في ذلك التصميم والشعارات والبرمجيات، هي ملك لـ نبيه و محمية بموجب قوانين الملكية الفكرية.
                </p>
              </Section>

              <Section title="8. إخلاء المسؤولية">
                <p>
                  تُقدم الخدمة &quot;كما هي&quot; بدون ضمانات من أي نوع. لا نضمن أن الخدمة ستكون خالية من الأخطاء أو متاحةตลอด الوقت.
                </p>
              </Section>

              <Section title="9. تحديد المسؤولية">
                <p>
                  في أي حال من الأحوال، لن نكون مسؤولين عن أي أضرار غير مباشرة أو عرضية أو خاصة ناتجة عن استخدام الخدمة.
                </p>
              </Section>

              <Section title="10. إنهاء الخدمة">
                <ul className="list-disc pl-6 space-y-1">
                  <li>يمكنك إلغاء حسابك في أي وقت</li>
                  <li>نحتفظ بالحق في تعليق أو إنهاء حسابك في حالة انتهاك هذه الشروط</li>
                  <li>يمكنك طلب حذف بياناتك بعد إنهاء الحساب</li>
                </ul>
              </Section>

              <Section title="11. تعديلات الشروط">
                <p>
                  نحتفظ بالحق في تعديل هذه الشروط في أي وقت. سيتم إخطارك بالتغييرات الجوهرية عبر البريد الإلكتروني أو من خلال الخدمة.
                </p>
              </Section>

              <Section title="12. القانون الحاكم">
                <p>
                  تخضع هذه الشروط لقوانين جمهورية مصر العربية.
                </p>
              </Section>

              <Section title="13. التواصل">
                <p>
                  لأي استفسارات بشأن هذه الشروط، يُرجى التواصل معنا على:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>البريد الإلكتروني: <a href="mailto:hello@nabeeh.app" className="text-primary hover:underline">hello@nabeeh.app</a></li>
                  <li>واتساب: <a href="https://wa.me/201234567890" className="text-primary hover:underline">تواصل معنا</a></li>
                </ul>
              </Section>
            </>
          ) : (
            <>
              <Section title="1. Acceptance of Terms">
                <p>
                  By accessing or using Nabeeh (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to any of these terms, please do not use the Service.
                </p>
              </Section>

              <Section title="2. Description of Service">
                <p>
                  Nabeeh is a smart teaching assistant accessible via the web that provides student management, attendance tracking, grade management, and automated parent communication through WhatsApp.
                </p>
              </Section>

              <Section title="3. Accounts">
                <ul className="list-disc pl-6 space-y-1">
                  <li>You must be at least 18 years old to create an account</li>
                  <li>You are responsible for maintaining the confidentiality of your account credentials</li>
                  <li>You are responsible for all activities that occur under your account</li>
                  <li>You must notify us immediately of any unauthorized use of your account</li>
                </ul>
              </Section>

              <Section title="4. Using the Service">
                <p>You agree to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Use the Service only for legitimate educational purposes</li>
                  <li>Not share your account credentials with third parties</li>
                  <li>Not attempt unauthorized access to the system</li>
                  <li>Not use the Service for any illegal purpose</li>
                </ul>
              </Section>

              <Section title="5. Student and Parent Data">
                <ul className="list-disc pl-6 space-y-1">
                  <li>You are responsible for obtaining parental consent for collecting their children&apos;s data</li>
                  <li>You are responsible for the accuracy of the data you enter</li>
                  <li>We protect student data in compliance with Egypt&apos;s Data Protection Law</li>
                </ul>
              </Section>

              <Section title="6. Pricing and Payment">
                <ul className="list-disc pl-6 space-y-1">
                  <li>The Service is free for individual users (up to 20 students)</li>
                  <li>Paid plans will be available in the future</li>
                  <li>We reserve the right to modify pricing with advance notice</li>
                </ul>
              </Section>

              <Section title="7. Intellectual Property">
                <p>
                  All content on the Service, including designs, logos, and software, is the property of Nabeeh and is protected by intellectual property laws.
                </p>
              </Section>

              <Section title="8. Disclaimer of Warranties">
                <p>
                  The Service is provided &quot;as is&quot; without warranties of any kind. We do not guarantee that the Service will be error-free or available at all times.
                </p>
              </Section>

              <Section title="9. Limitation of Liability">
                <p>
                  In no event shall we be liable for any indirect, incidental, or special damages arising from the use of the Service.
                </p>
              </Section>

              <Section title="10. Termination">
                <ul className="list-disc pl-6 space-y-1">
                  <li>You may cancel your account at any time</li>
                  <li>We reserve the right to suspend or terminate your account for violating these terms</li>
                  <li>You may request deletion of your data after account termination</li>
                </ul>
              </Section>

              <Section title="11. Changes to Terms">
                <p>
                  We reserve the right to modify these terms at any time. Material changes will be notified via email or through the Service.
                </p>
              </Section>

              <Section title="12. Governing Law">
                <p>
                  These terms are governed by the laws of the Arab Republic of Egypt.
                </p>
              </Section>

              <Section title="13. Contact Us">
                <p>
                  For any questions about these Terms, please contact us at:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Email: <a href="mailto:hello@nabeeh.app" className="text-primary hover:underline">hello@nabeeh.app</a></li>
                  <li>WhatsApp: <a href="https://wa.me/201234567890" className="text-primary hover:underline">Contact us</a></li>
                </ul>
              </Section>
            </>
          )}
        </div>

        <div className="mt-12 pt-8 border-t border-ink/10">
          <Link
            href={`/${locale}`}
            className="text-primary hover:text-primary/80 font-body font-medium"
          >
            {isAr ? "← العودة إلى الصفحة الرئيسية" : "← Back to Homepage"}
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
