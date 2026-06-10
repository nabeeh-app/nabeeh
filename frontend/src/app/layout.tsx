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
  title: "Nabeeh - Smart Teaching Assistant",
  description: "AI-powered teaching assistant with WhatsApp integration for student management, attendance tracking, and parent communication.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
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
