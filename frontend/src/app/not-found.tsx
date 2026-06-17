import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page you're looking for doesn't exist or has been moved.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="text-center px-4">
        <h1 className="text-7xl font-bold text-primary font-display mb-4">404</h1>
        <h2 className="text-2xl font-bold text-ink font-display mb-2">
          Page not found
        </h2>
        <p className="text-ink/60 font-body mb-8 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/en"
            className="px-6 py-3 bg-primary text-white rounded-lg font-body font-medium hover:bg-primary/90 transition-colors"
          >
            Go to Homepage
          </Link>
          <Link
            href="/en/login"
            className="px-6 py-3 border border-ink/20 text-ink rounded-lg font-body font-medium hover:bg-ink/5 transition-colors"
          >
            Log In
          </Link>
        </div>
      </div>
    </div>
  );
}
