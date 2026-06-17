# Plan 037: Add comparison content section and expand sitemap for AEO

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8c2f04b..HEAD -- frontend/src/app/sitemap.ts frontend/src/components/landing/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 036
- **Category**: direction
- **Planned at**: commit `8c2f04b`, 2026-06-17
- **Issue**: —

## Why this matters

When users ask ChatGPT or Perplexity "best teaching assistant for tutors in Egypt" or "Nabeeh vs Excel for tutoring", AI engines look for comparison content — pages that explicitly compare alternatives. Currently Nabeeh has no comparison content, so AI engines cite competitor pages or generic "top 10 tools" lists instead. Additionally, the sitemap only includes 3 public pages (root, login, register) but terms and privacy pages exist and should be crawlable for AI indexing.

## Current state

- `frontend/src/app/sitemap.ts:5-9` — only lists root, login, register pages. Terms and privacy pages exist at `frontend/src/app/[locale]/terms/page.tsx` and `frontend/src/app/[locale]/privacy/page.tsx` but are not in the sitemap.
- `frontend/src/app/[locale]/page.tsx:14-38` — landing page renders: Hero → ProblemSection → FeaturesSection → ScreenshotCarousel → PricingSection → FAQSection → Footer. No comparison section.
- `frontend/src/app/[locale]/terms/page.tsx` — Terms of Service page (public, bilingual).
- `frontend/src/app/[locale]/privacy/page.tsx` — Privacy Policy page (public, bilingual).

## Commands you will need

| Purpose   | Command                        | Expected on success |
|-----------|--------------------------------|---------------------|
| Dev check | `cd frontend && npm run build` | exit 0              |

## Scope

**In scope**:
- `frontend/src/app/sitemap.ts`
- `frontend/src/app/[locale]/page.tsx`
- `frontend/src/components/landing/ComparisonSection.tsx` (new file)
- `frontend/src/messages/en.json` (add `landing.comparison` section)
- `frontend/src/messages/ar.json` (add `landing.comparison` section)

**Out of scope**:
- Other landing components
- Schema changes (handled in 033, 034)
- Content changes to existing sections (handled in 035)

## Steps

### Step 1: Add terms and privacy pages to sitemap

Edit `frontend/src/app/sitemap.ts` to add the missing public pages:

**Before:**
```typescript
const publicPages = [
  { path: "", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/login", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/register", priority: 0.8, changeFrequency: "monthly" as const },
];
```

**After:**
```typescript
const publicPages = [
  { path: "", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/login", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/register", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
];
```

**Verify**: Open `sitemap.ts`, confirm 5 pages in the array.

### Step 2: Add comparison translations to en.json

Add a `landing.comparison` section to `frontend/src/messages/en.json` (after `landing.faq`):

```json
"comparison": {
  "title": "Why tutors choose Nabeeh over spreadsheets",
  "subtitle": "Nabeeh replaces Excel, Google Sheets, and scattered WhatsApp messages with one integrated platform.",
  "items": [
    {
      "feature": "Attendance tracking",
      "old": "Manual entry in Excel or Google Sheets with no real-time visibility",
      "new": "One-tap bulk marking with automatic attendance rate calculation and at-risk student alerts"
    },
    {
      "feature": "Grade management",
      "old": "Formulas that break, version conflicts, and no way to share results with parents",
      "new": "Grade entry with automatic averages, distributions, and PDF export"
    },
    {
      "feature": "Parent communication",
      "old": "Scattered WhatsApp messages with no structured data",
      "new": "WhatsApp bot that answers parent queries about attendance and grades automatically"
    },
    {
      "feature": "Student reports",
      "old": "Manually compiled reports that take hours to prepare",
      "new": "AI-generated reports from real data, sent to parents via WhatsApp in one click"
    },
    {
      "feature": "Multi-group management",
      "old": "Separate spreadsheets per class with no unified view",
      "new": "Single dashboard for all groups, subjects, and schedules"
    },
    {
      "feature": "Bilingual support",
      "old": "Arabic-only or English-only tools",
      "new": "Full Arabic and English interface with language switching"
    }
  ]
}
```

**Verify**: Open `en.json`, confirm `landing.comparison` exists with 6 items.

### Step 3: Add comparison translations to ar.json

Add the equivalent `landing.comparison` section to `frontend/src/messages/ar.json` with Arabic translations following the same structure.

**Verify**: Open `ar.json`, confirm `landing.comparison` exists.

### Step 4: Create ComparisonSection component

Create `frontend/src/components/landing/ComparisonSection.tsx`:

```tsx
'use client';

import { useTranslations, useLocale } from 'next-intl';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ComparisonSection() {
  const t = useTranslations('landing.comparison');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const items = [0, 1, 2, 3, 4, 5];

  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-ink font-display mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-ink/60 font-body max-w-2xl mx-auto">
            {t('subtitle')}
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-4">
          {items.map((i) => (
            <div
              key={i}
              className="bg-canvas border border-ink/10 rounded-xl p-6 grid md:grid-cols-[1fr,auto,1fr] gap-4 items-center"
            >
              <div className={cn('text-sm text-ink/50 font-body', isRTL && 'text-right')}>
                {t(`items.${i}.old`)}
              </div>
              <div className="flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <ArrowRight className={cn('w-5 h-5 text-primary', isRTL && 'rotate-180')} />
                </div>
              </div>
              <div className={cn('text-sm text-ink font-body font-medium', isRTL && 'text-right')}>
                <Check className="w-4 h-4 text-primary inline mr-1" />
                {t(`items.${i}.new`)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

**Verify**: File exists and exports `ComparisonSection`.

### Step 5: Add ComparisonSection to landing page

Edit `frontend/src/app/[locale]/page.tsx` to import and render the new component:

Add import:
```tsx
import { ComparisonSection } from '@/components/landing/ComparisonSection';
```

Add after `<FeaturesSection />` (before `<ScreenshotCarousel />`):
```tsx
<ComparisonSection />
```

**Verify**: `cd frontend && npm run build` exits 0.

### Step 6: Add ComparisonPage JSON-LD to LandingJsonLd.tsx

Add a `comparisonSchema` to `frontend/src/components/landing/LandingJsonLd.tsx`:

```typescript
const comparisonSchema = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Nabeeh vs Spreadsheets for Tutoring",
  description: "Compare Nabeeh's teaching assistant platform with Excel and Google Sheets for attendance tracking, grade management, and parent communication.",
  mainEntity: {
    "@type": "SoftwareApplication",
    name: "Nabeeh",
    applicationCategory: "EducationalApplication",
    url: "https://nabeeh.app",
  },
};
```

Add a `<script>` tag for it in the JSX return.

**Verify**: `cd frontend && npm run build` exits 0.

## Test plan

- No new unit tests — content and component changes.
- Manual verification: visit `/en`, confirm the comparison section renders between features and screenshots with 6 comparison items.
- Verify `/sitemap.xml` includes `/en/terms` and `/en/privacy` URLs.

## Done criteria

- [ ] `sitemap.ts` includes terms and privacy pages
- [ ] `en.json` has `landing.comparison` with 6 items
- [ ] `ar.json` has `landing.comparison` with 6 items
- [ ] `ComparisonSection.tsx` exists and renders comparison items
- [ ] `page.tsx` renders `<ComparisonSection />` between features and screenshots
- [ ] `LandingJsonLd.tsx` has comparison page schema
- [ ] `npm run build` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- `npm run build` fails after changes.
- The comparison content makes factual claims that can't be verified (e.g., specific competitor names) — use generic alternatives ("spreadsheets", "manual tools").

## Maintenance notes

- **Comparison content**: If competitors are named in the future, ensure all claims are verifiable and fair. Generic comparisons ("spreadsheets") are safer.
- **New public pages**: Any future public pages (blog, changelog, docs) should be added to the sitemap.
- **A/B testing**: Test whether comparison sections increase signup conversion.
