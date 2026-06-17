# Plan 035: Add Speakable and HowTo schemas for voice/search AEO

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8c2f04b..HEAD -- frontend/src/components/landing/LandingJsonLd.tsx frontend/src/components/landing/Hero.tsx`
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

Voice assistants (Google Assistant, Siri, Alexa) and AI answer engines use `Speakable` schema to identify which content to read aloud in voice search results. `HowTo` schema gives AI a structured step-by-step extraction path for setup guides — these get cited when users ask "how do I set up Nabeeh?" or "how to use Nabeeh for attendance". Currently neither exists.

## Current state

- `frontend/src/components/landing/LandingJsonLd.tsx` — has FAQPage + WebSite schemas. No Speakable, no HowTo.
- `frontend/src/components/landing/Hero.tsx:20-24` — the hero `<h1>` and subtitle `<p>` are the most speakable content on the page.
- The FAQ section (`en.json:1039-1064`) has setup-related content: "How long does it take to set up?" with answer "You can get started in minutes..."

## Commands you will need

| Purpose   | Command                        | Expected on success |
|-----------|--------------------------------|---------------------|
| Dev check | `cd frontend && npm run build` | exit 0              |

## Scope

**In scope**:
- `frontend/src/components/landing/LandingJsonLd.tsx`

**Out of scope**:
- Hero component (content changes in plan 035)
- Translation files

## Steps

### Step 1: Add Speakable schema to LandingJsonLd.tsx

Add a `speakableData` constant after the `websiteData` constant:

```typescript
const speakableData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Nabeeh - Smart Teaching Assistant",
  speakable: {
    "@type": "SpeakableSpecification",
    cssSelector: ["h1", ".hero-subtitle"],
  },
};
```

Add a `<script>` tag for it in the JSX return:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(speakableData) }}
/>
```

**Verify**: Open `LandingJsonLd.tsx` and confirm `speakableData` exists and is rendered.

### Step 2: Add HowTo schema to LandingJsonLd.tsx

Add a `howToData` constant after `speakableData`:

```typescript
const howToData = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to set up Nabeeh for your tutoring business",
  description: "Get started with Nabeeh in minutes. Set up attendance tracking, grade management, and WhatsApp parent communication for your tutoring classes.",
  step: [
    {
      "@type": "HowToStep",
      name: "Create your account",
      text: "Sign up for free at nabeeh.app. Enter your name, email, and phone number to create your teacher account.",
    },
    {
      "@type": "HowToStep",
      name: "Add your students",
      text: "Add students individually or import them from an Excel file. Each student gets a profile with their details and enrollment information.",
    },
    {
      "@type": "HowToStep",
      name: "Set up groups and classes",
      text: "Create course offerings and groups for your classes. Assign students to groups and set schedules.",
    },
    {
      "@type": "HowToStep",
      name: "Connect WhatsApp",
      text: "Link your WhatsApp account so parents can message you directly. The bot automatically responds to parent queries about attendance and grades.",
    },
    {
      "@type": "HowToStep",
      name: "Start tracking",
      text: "Mark attendance in seconds, enter grades, and generate performance reports. Parents receive updates via WhatsApp automatically.",
    },
  ],
  totalTime: "PT10M",
};
```

Add a `<script>` tag for it in the JSX return:

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(howToData) }}
/>
```

**Verify**: `cd frontend && npm run build` exits 0.

## Test plan

- No new tests needed — static JSON-LD blocks.
- Manual verification: view page source on `/en`, confirm 5 `<script type="application/ld+json">` blocks exist (Organization, SoftwareApplication, FAQPage, WebSite+Speakable, HowTo).

## Done criteria

- [ ] `LandingJsonLd.tsx` contains Speakable schema with `cssSelector` targeting h1 and subtitle
- [ ] `LandingJsonLd.tsx` contains HowTo schema with 5 steps and `totalTime`
- [ ] `npm run build` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- `npm run build` fails after changes.
- The HowTo steps don't match the actual onboarding flow — verify against `onboarding` translations in `en.json` before writing steps.

## Maintenance notes

- **HowTo steps**: If the onboarding flow changes, update the HowTo steps to match. The steps above are based on `en.json:1104-1155` (onboarding translations).
- **Speakable cssSelector**: The `.hero-subtitle` class must exist on the hero subtitle element. If the class name changes in plan 035, update this selector.
- **totalTime**: `"PT10M"` is an estimate. Adjust based on actual onboarding data if available.
