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
    en: "Privacy Policy - Nabeeh",
    ar: "سياسة الخصوصية - نبيه",
  };
  const descriptions: Record<string, string> = {
    en: "Nabeeh privacy policy. Learn how we collect, use, and protect your personal data in compliance with Egypt's Data Protection Law.",
    ar: "سياسة خصوصية نبيه. تعرّف على كيفية جمع واستخدام وحماية بياناتك الشخصية وفقًا لقانون حماية البيانات الشخصية المصري.",
  };
  return {
    title: titles[locale] || titles.en,
    description: descriptions[locale] || descriptions.en,
    robots: { index: true, follow: true },
    alternates: {
      canonical: `https://nabeeh.app/${locale}/privacy`,
      languages: { en: "https://nabeeh.app/en/privacy", ar: "https://nabeeh.app/ar/privacy" },
    },
  };
}

export default async function PrivacyPolicy({
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
          {isAr ? "سياسة الخصوصية" : "Privacy Policy"}
        </h1>
        <p className="text-sm text-ink/50 font-body mb-10">
          {isAr ? "آخر تحديث: يونيو 2026" : "Last updated: June 2026"}
        </p>

        <div className="prose prose-ink max-w-none font-body space-y-8 text-ink/80 leading-relaxed">
          {isAr ? (
            <>
              <Section title="1. مقدمة">
                نظام نبيه (&quot;الخدمة&quot;) هو منصة تعليمية ذكية تعمل عبر الويب وتُدار بواسطة نبيه (&quot;نحن&quot;). نلتزم بحماية خصوصيتك وبياناتك الشخصية. تصف هذه السياسة كيفية جمع واستخدام وحماية معلوماتك باستخدام الخدمة.
              </Section>

              <Section title="2. المعلومات التي نجمعها">
                <p className="font-semibold">معلومات الحساب:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>الاسم الكامل والبريد الإلكتروني ورقم الهاتف</li>
                  <li>اسم المؤسسة (إن وُجد)</li>
                  <li>المواد الدراسي التي تُدرّسها</li>
                </ul>
                <p className="font-semibold mt-4">بيانات الطلاب:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>أسماء الطلاب وأرقام هواتفهم</li>
                  <li>بيانات الحضور والغياب</li>
                  <li>الدرجات والتقييمات</li>
                </ul>
                <p className="font-semibold mt-4">بيانات أولياء الأمور:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>أرقام واتساب الخاصة بأولياء الأمور</li>
                  <li>سجلات المحادثات مع بوت واتساب</li>
                </ul>
              </Section>

              <Section title="3. كيف نستخدم معلوماتك">
                <ul className="list-disc pl-6 space-y-1">
                  <li>توفير وإدارة الخدمة (الحضور، الدرجات، التواصل)</li>
                  <li>تشغيل بوت واتساب للرد على استفسارات أولياء الأمور</li>
                  <li>إرسال إشعارات وتقارير مخصصة</li>
                  <li>تحسين تجربة المستخدم وتطوير الميزات الجديدة</li>
                  <li>التواصل معك بخصوص حسابك والتحديثات</li>
                </ul>
              </Section>

              <Section title="4. مشاركة البيانات">
                <p>لا نبيع بياناتك لأي طرف ثالث. قد نشارك معلوماتك فقط في الحالات التالية:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>بموافقتك الصريحة</li>
                  <li>مع مزودي الخدمات المباشرين (مثل Supabase لتخزين البيانات وWhatsApp Business)</li>
                  <li>عندما يقتضي القانون ذلك</li>
                </ul>
              </Section>

              <Section title="5. حماية البيانات خارج مصر">
                <p>
                  تُخزن بياناتك على خوادم Supabase التي تقع في الاتحاد الأوروبي والولايات المتحدة. نضمن أن جميع نقل البيانات يتم وفقًا لمعايير الحماية المناسبة ومتطلبات قانون حماية البيانات الشخصية المصري (القانون رقم 151 لسنة 2020).
                </p>
              </Section>

              <Section title="6. حقوقك">
                <p>لديك الحق في:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>الوصول إلى بياناتك الشخصية</li>
                  <li>تصحيح أي بيانات غير دقيقة</li>
                  <li>طلب حذف بياناتك</li>
                  <li>الاعتراض على معالجة بياناتك</li>
                  <li>تصدير بياناتك بصيغة منظمة</li>
                </ul>
                <p className="mt-2">
                  لممارسة هذه الحقوق، تواصل معنا على <a href="mailto:hello@nabeeh.com" className="text-primary hover:underline">hello@nabeeh.com</a>.
                </p>
              </Section>

              <Section title="7. أمان البيانات">
                <ul className="list-disc pl-6 space-y-1">
                  <li>تشفير جميع البيانات أثناء النقل والتخزين</li>
                  <li>المصادقة المعممة والتحكم في الوصول</li>
                  <li>المراقبة المستمرة للthreats الأمنية</li>
                </ul>
              </Section>

              <Section title="8. إخطار الخرق">
                <p>
                  في حالة خرق أمني يؤثر على بياناتك، سنبشرك بذلك خلال 72 ساعة من اكتشافه، وفقًا لمتطلبات قانون حماية البيانات الشخصية المصري.
                </p>
              </Section>

              <Section title="9. ملفات تعريف الارتباط">
                <p>
                  نستخدم ملفات تعريف الارتباط لتحسين تجربتك. يُرجى الاطلاع على إشعار ملفات تعريف الارتباط الخاصة بنا لمزيد من التفاصيل.
                </p>
              </Section>

              <Section title="10. التواصل">
                <p>
                  لأي استفسارات بشأن هذه السياسة، يُرجى التواصل معنا على:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>البريد الإلكتروني: <a href="mailto:hello@nabeeh.com" className="text-primary hover:underline">hello@nabeeh.com</a></li>
                  <li>واتساب: <a href="https://wa.me/201234567890" className="text-primary hover:underline">تواصل معنا</a></li>
                </ul>
              </Section>
            </>
          ) : (
            <>
              <Section title="1. Introduction">
                Nabeeh (&quot;the Service&quot;) is a smart teaching assistant platform accessible via the web, operated by Nabeeh (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). We are committed to protecting your privacy and personal data. This Privacy Policy describes how we collect, use, and safeguard your information when you use the Service.
              </Section>

              <Section title="2. Information We Collect">
                <p className="font-semibold">Account Information:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Full name, email address, and phone number</li>
                  <li>Institution name (if applicable)</li>
                  <li>Subjects you teach</li>
                </ul>
                <p className="font-semibold mt-4">Student Data:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Student names and phone numbers</li>
                  <li>Attendance records</li>
                  <li>Grades and assessments</li>
                </ul>
                <p className="font-semibold mt-4">Parent Data:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Parent WhatsApp numbers</li>
                  <li>WhatsApp bot conversation logs</li>
                </ul>
              </Section>

              <Section title="3. How We Use Your Information">
                <ul className="list-disc pl-6 space-y-1">
                  <li>Providing and operating the Service (attendance, grades, communication)</li>
                  <li>Operating the WhatsApp bot to respond to parent queries</li>
                  <li>Sending notifications and custom reports</li>
                  <li>Improving user experience and developing new features</li>
                  <li>Communicating with you about your account and updates</li>
                </ul>
              </Section>

              <Section title="4. Data Sharing">
                <p>We do not sell your data to any third parties. We may share your information only in the following cases:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>With your explicit consent</li>
                  <li>With direct service providers (e.g., Supabase for data storage and WhatsApp Business)</li>
                  <li>When required by law</li>
                </ul>
              </Section>

              <Section title="5. Data Transfer Outside Egypt">
                <p>
                  Your data is stored on Supabase servers located in the European Union and the United States. We ensure that all data transfers comply with appropriate protection standards and the requirements of Egypt&apos;s Data Protection Law (Law No. 151 of 2020).
                </p>
              </Section>

              <Section title="6. Your Rights">
                <p>You have the right to:</p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Access your personal data</li>
                  <li>Correct any inaccurate data</li>
                  <li>Request deletion of your data</li>
                  <li>Object to the processing of your data</li>
                  <li>Export your data in a structured format</li>
                </ul>
                <p className="mt-2">
                  To exercise these rights, contact us at <a href="mailto:hello@nabeeh.com" className="text-primary hover:underline">hello@nabeeh.com</a>.
                </p>
              </Section>

              <Section title="7. Data Security">
                <ul className="list-disc pl-6 space-y-1">
                  <li>All data is encrypted in transit and at rest</li>
                  <li>Authentication and access controls are enforced</li>
                  <li>Continuous monitoring for security threats</li>
                </ul>
              </Section>

              <Section title="8. Breach Notification">
                <p>
                  In the event of a security breach that affects your data, we will notify you within 72 hours of discovery, in compliance with Egypt&apos;s Data Protection Law requirements.
                </p>
              </Section>

              <Section title="9. Cookies">
                <p>
                  We use cookies to improve your experience. Please refer to our Cookie Notice for details.
                </p>
              </Section>

              <Section title="10. Contact Us">
                <p>
                  For any questions about this Privacy Policy, please contact us at:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Email: <a href="mailto:hello@nabeeh.com" className="text-primary hover:underline">hello@nabeeh.com</a></li>
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
