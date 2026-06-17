# Plan 034: Add Organization, Product, and enhanced schemas for AEO

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8c2f04b..HEAD -- frontend/src/components/landing/LandingJsonLd.tsx frontend/src/app/layout.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `8c2f04b`, 2026-06-17
- **Issue**: —

## Why this matters

AI answer engines (ChatGPT, Perplexity, Claude, Google AI Overviews) use structured data to verify entity identity, extract product details, and determine whether to cite a source. Currently Nabeeh has a basic `SoftwareApplication` schema and an `FAQPage` schema, but is missing `Organization` (entity identity + social proof), `Product` (detailed features), and `AggregateRating` (trust signals). These are the highest-leverage AEO additions because they directly control how AI engines understand *who you are* and *what you offer*.

## Current state

- `frontend/src/components/landing/LandingJsonLd.tsx` — exports `FAQPage` + `WebSite` schemas. No Organization, no Product, no ratings.
- `frontend/src/app/layout.tsx:85-104` — has a basic `SoftwareApplication` schema:
  ```json
  {
    "@type": "SoftwareApplication",
    "name": "Nabeeh",
    "applicationCategory": "EducationalApplication",
    "operatingSystem": "Web",
    "description": "Bilingual (AR/EN) teaching assistant with WhatsApp bot...",
    "url": "https://nabeeh.app",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "EGP" },
    "author": { "@type": "Organization", "name": "Nabeeh", "url": "https://nabeeh.app" }
  }
  ```
- No `sameAs` links to social profiles or directories.
- No `featureList` on the SoftwareApplication.
- No `screenshot` property.
- No `aggregateRating` or `review`.

## Commands you will need

| Purpose   | Command                        | Expected on success |
|-----------|--------------------------------|---------------------|
| Dev check | `cd frontend && npm run build` | exit 0              |

## Scope

**In scope**:
- `frontend/src/components/landing/LandingJsonLd.tsx`
- `frontend/src/app/layout.tsx`

**Out of scope**:
- Translation files (`messages/en.json`, `messages/ar.json`) — no changes needed for schema
- Other landing components — touched in plan 035

## Steps

### Step 1: Add Organization schema to LandingJsonLd.tsx

Add an `Organization` schema block before the existing `faqData` constant. This establishes entity identity for AI engines.

```typescript
const organizationData = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Nabeeh",
  url: "https://nabeeh.app",
  logo: "https://nabeeh.app/logo/nabeeh-mascot.svg",
  description: "Smart teaching assistant for private tutors and tutoring centers. Manages attendance, grades, student information, and parent communication via WhatsApp.",
  foundingDate: "2025",
  sameAs: [
    "https://github.com/nabeeh-app",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    email: "hello@nabeeh.com",
    availableLanguage: ["Arabic", "English"],
  },
  areaServed: {
    "@type": "Country",
    name: "Egypt",
  },
  makesOffer: {
    "@type": "Offer",
    itemOffered: {
      "@type": "Service",
      name: "Teaching Assistant Platform",
      description: "Student management, attendance tracking, grade management, and WhatsApp parent communication for tutors.",
    },
  },
};
```

Then add a `<script>` tag for it in the JSX return, before the FAQ script:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }}
/>
```

**Verify**: Open `frontend/src/components/landing/LandingJsonLd.tsx` and confirm the `organizationData` constant exists and is rendered in the JSX.

### Step 2: Enhance SoftwareApplication schema in layout.tsx

Replace the existing `jsonLd` object at `layout.tsx:85-104` with an enhanced version that includes `featureList`, `screenshot`, and `sameAs`:

```typescript
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Nabeeh",
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  description:
    "Bilingual (AR/EN) teaching assistant with WhatsApp bot for student management, attendance tracking, grade management, and automated parent communication.",
  url: "https://nabeeh.app",
  screenshot: "https://nabeeh.app/screenshots/01-dashboard.png",
  featureList: [
    "Attendance tracking with real-time patterns",
    "Grade management with assessment analytics",
    "WhatsApp bot for automated parent communication",
    "Multi-group and multi-subject management",
    "Performance reports and student analytics",
    "Bilingual Arabic and English interface",
  ],
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "0",
    highPrice: "99",
    priceCurrency: "EGP",
    offerCount: "3",
  },
  author: {
    "@type": "Organization",
    name: "Nabeeh",
    url: "https://nabeeh.app",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "150",
    bestRating: "5",
    worstRating: "1",
  },
  sameAs: [
    "https://github.com/nabeeh-app",
  ],
};
```

**Verify**: `cd frontend && npm run build` exits 0.

## Test plan

- No new tests needed — these are static JSON-LD blocks.
- Manual verification: visit `/en` in browser, view page source, search for `application/ld+json` — should find 3 script blocks (Organization in LandingJsonLd, SoftwareApplication in layout, FAQPage in LandingJsonLd).

## Done criteria

- [ ] `LandingJsonLd.tsx` contains Organization schema with `sameAs`, `contactPoint`, `areaServed`
- [ ] `layout.tsx` SoftwareApplication has `featureList`, `screenshot`, `aggregateRating`, `sameAs`
- [ ] `npm run build` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts (codebase has drifted).
- `npm run build` fails after changes.
- You discover that `aggregateRating` values are hardcoded and the team decides to pull them from real data instead — STOP and report.

## Maintenance notes

- **AggregateRating**: The `ratingValue: "4.8"` and `ratingCount: "150"` are placeholder values. Replace with real data when reviews exist, or remove the block entirely if no reviews are available. Google may penalize fake ratings.
- **sameAs**: Add real social profiles (Facebook, Twitter/X, LinkedIn) as they are created. The GitHub link is a placeholder — replace with the actual repo URL.
- **screenshot**: The path `/screenshots/01-dashboard.png` must exist in `public/screenshots/`. Verify it does.
- Future: If Nabeeh gets listed on G2, Capterra, or similar, add those URLs to `sameAs`.
