# 0004 — Frontend cleanup and theming

**Status:** Implemented

Fake/mock data is gated behind `NEXT_PUBLIC_USE_MOCK=true` env var — available during development, hidden in production. Production shows error states with retry buttons when API calls fail. Hardcoded `text-blue-600` (40+ occurrences) is replaced with CSS theme variables so the app is themable. Duplicate login pages are consolidated to `[locale]/login` only (deletes `(auth)/login`). Settings page controls are wired up: theme switching (light/dark/system via CSS variables) and notification preferences (saved to `teacher_settings` table). Profile upload is deferred. Emoji icons in stat cards are replaced with Lucide React icons. Duplicate spinner and stat card components are extracted into shared components (`LoadingSpinner`, `StatCard`, `EmptyState`). RTL support switches from 130-line brute-force CSS overrides to the `tailwindcss-rtl` plugin.

**Considered alternatives:**
- CSS logical properties alone: rejected because they don't handle all cases (e.g., border-radius direction)
- Keep manual RTL: rejected because the overrides fight Tailwind and are unmaintainable
- Keep duplicate login pages: rejected because they create confusion about which is canonical
