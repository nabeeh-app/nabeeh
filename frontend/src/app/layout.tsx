import type { Metadata } from "next";
import { DM_Mono } from "next/font/google";
import "./globals.css";
import ErrorBoundary from "@/components/error-boundary";
import ClarityScript from "@/components/ClarityScript";
import IconDefs from "@/components/IconDefs";

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
        url: "https://nabeeh.app/og-image.png",
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
    images: ["https://nabeeh.app/og-image.png"],
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
  return (
    <html suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `(function(){var p=location.pathname;if(p.startsWith('/ar')){document.documentElement.dir='rtl';document.documentElement.lang='ar';}else{document.documentElement.dir='ltr';document.documentElement.lang='en';}})()`
        }} />
        <link rel="preload" href="/fonts/thmanyahsans-Black.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/thmanyahsans-Medium.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/thmanyahsans-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/thmanyahserifdisplay-Black.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body
        className={`${dmMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <IconDefs />
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
        <ClarityScript />
      </body>
    </html>
  );
}
