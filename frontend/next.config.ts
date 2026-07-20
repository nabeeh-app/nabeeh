import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      // Base: only same-origin by default
      "default-src 'self'",

      // Scripts: self + Clarity (consent-gated).
      // 'unsafe-inline' required for Next.js bootstrap (__NEXT_DATA__, chunks, hydration).
      // 'unsafe-eval' intentionally omitted — no frontend code uses eval/new Function().
      // Clarity loaded dynamically via consent-gated component.
      "script-src 'self' 'unsafe-inline' https://www.clarity.ms",

      // Element-level <script> control (overrides script-src for script elements).
      'script-src-elem \'self\' \'unsafe-inline\' https://www.clarity.ms',

      // Styles: self + Tailwind/CSS-in-JS inline styles.
      "style-src 'self' 'unsafe-inline'",

      // Images: self, data: (inline icons/placeholders), https: (OG images, uploads).
      "img-src 'self' data: https:",

      // Fonts: self-hosted only (thmanyah fonts, no external CDNs).
      // next/font/google downloads at build time and serves from same origin.
      "font-src 'self'",

      // API connections: backend (self via rewrite), Supabase, Clarity analytics beacon.
      // *.supabase.in removed (legacy deprecated domain — not used).
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.clarity.ms",

      // Media: self-hosted only.
      "media-src 'self'",

      // No plugins, no frames, no form hijacking, no base injection.
      "object-src 'none'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",

      // Web Workers: same-origin only (none currently used).
      "worker-src 'self'",

      // Web app manifest: same-origin only (none currently used).
      'manifest-src \'self\'',
    ].join('; '),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Cross-Origin-Embedder-Policy',
    value: 'unsafe-none',
  },
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin',
  },
  {
    key: 'Cross-Origin-Resource-Policy',
    value: 'same-origin',
  },
];

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  poweredByHeader: false,
};

export default withNextIntl(nextConfig);
