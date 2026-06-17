import type { Metadata } from "next";
import { DM_Mono } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "@/components/error-boundary";

const dmMono = DM_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nabeeh.app"),
  title: {
    default: "Nabeeh - Smart Teaching Assistant for Tutors",
    template: "%s | Nabeeh",
  },
  description:
    "Bilingual (AR/EN) teaching assistant with WhatsApp bot for student management, attendance tracking, grade management, and automated parent communication.",
  keywords: [
    "teaching assistant",
    "student management",
    "attendance tracking",
    "WhatsApp bot",
    "parent communication",
    "tutoring",
    "grades",
    "classroom management",
    "private tutor",
    "Egypt",
    "MENA",
  ],
  authors: [{ name: "Nabeeh" }],
  creator: "Nabeeh",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://nabeeh.app",
    siteName: "Nabeeh",
    title: "Nabeeh - Smart Teaching Assistant for Tutors",
    description:
      "Bilingual (AR/EN) teaching assistant with WhatsApp bot for student management, attendance tracking, and automated parent communication.",
    images: [
      {
        url: "/api/og",
        width: 1200,
        height: 630,
        alt: "Nabeeh - Smart Teaching Assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Nabeeh - Smart Teaching Assistant for Tutors",
    description:
      "Bilingual (AR/EN) teaching assistant with WhatsApp bot for student management, attendance tracking, and automated parent communication.",
    images: ["/api/og"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://nabeeh.app",
    languages: {
      en: "https://nabeeh.app/en",
      ar: "https://nabeeh.app/ar",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Nabeeh",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    description:
      "Bilingual (AR/EN) teaching assistant with WhatsApp bot for student management, attendance tracking, and automated parent communication.",
    url: "https://nabeeh.app",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "EGP",
    },
    author: {
      "@type": "Organization",
      name: "Nabeeh",
      url: "https://nabeeh.app",
    },
  };

  return (
    <html suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "x86kzi0f6e");`,
          }}
        />
      </head>
      <body
        className={`${dmMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </body>
    </html>
  );
}
