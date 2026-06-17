# Plan 036: Rewrite landing content for AEO extractability

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8c2f04b..HEAD -- frontend/src/messages/en.json frontend/src/messages/ar.json frontend/src/components/landing/Hero.tsx frontend/src/components/landing/FeaturesSection.tsx frontend/src/components/landing/ProblemSection.tsx frontend/src/components/landing/FAQSection.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: 034, 035
- **Category**: direction
- **Planned at**: commit `8c2f04b`, 2026-06-17
- **Issue**: —

## Why this matters

AI answer engines extract the first 50 words of a page as the "answer snippet." Currently the hero subtitle, feature descriptions, and FAQ answers use marketing copy language ("Stop juggling multiple tools") instead of self-contained factual statements that AI can cleanly extract and cite. The AEO research shows: lead with the claim, stack proof next, and place trust signals where an engine can see them. Content that follows the Answer-Evidence-Depth (AED) pattern gets cited ~3x more often.

## Current state

- `frontend/src/messages/en.json:926-927` — hero subtitle: `"Track attendance, manage grades, and communicate with parents — all through WhatsApp. Built for private tutors and tutoring centers in Egypt."` — this is decent but generic.
- `frontend/src/messages/en.json:958-981` — feature descriptions use marketing language like "Mark attendance in seconds" instead of factual statements.
- `frontend/src/messages/en.json:934-953` — problem section uses emotional language instead of factual comparisons.
- `frontend/src/messages/en.json:1039-1064` — FAQ answers are concise but some are vague ("enterprise-grade security").
- `frontend/src/components/landing/Hero.tsx:20-24` — renders `t('title')` and `t('subtitle')`.
- `frontend/src/components/landing/FeaturesSection.tsx` — renders feature cards from translations.
- All components are `'use client'` — content is rendered client-side from i18n keys.

## Commands you will need

| Purpose   | Command                        | Expected on success |
|-----------|--------------------------------|---------------------|
| Dev check | `cd frontend && npm run build` | exit 0              |

## Scope

**In scope**:
- `frontend/src/messages/en.json` (landing.hero, landing.features, landing.problem, landing.faq sections only)
- `frontend/src/messages/ar.json` (matching sections — Arabic translations must also be updated)
- `frontend/src/components/landing/Hero.tsx` (add subtitle class for Speakable selector)
- `frontend/src/components/landing/FeaturesSection.tsx` (add semantic class for AI extraction)

**Out of scope**:
- Non-landing translation keys
- Other landing components (Footer, PricingSection, CTASection, etc.)
- Schema changes (handled in 033, 034)

## Steps

### Step 1: Rewrite hero subtitle for answer-first structure

In `frontend/src/messages/en.json`, replace the hero section (`landing.hero`):

**Before:**
```json
"hero": {
  "title": "The smart way to manage your tutoring business",
  "subtitle": "Track attendance, manage grades, and communicate with parents — all through WhatsApp. Built for private tutors and tutoring centers in Egypt.",
  "cta": {
    "start": "Start Free",
    "login": "Sign In"
  }
}
```

**After:**
```json
"hero": {
  "title": "Nabeeh: Smart teaching assistant for private tutors",
  "subtitle": "Nabeeh is a bilingual (Arabic/English) teaching platform that automates attendance tracking, grade management, and WhatsApp parent communication for tutors and tutoring centers in Egypt. Free for up to 20 students.",
  "cta": {
    "start": "Start Free",
    "login": "Sign In"
  }
}
```

Key changes:
- Title leads with the product name + category (entity clarity for AI)
- Subtitle is a self-contained factual statement (not marketing copy)
- Includes specific numbers ("up to 20 students")
- Mentions bilingual, which is a differentiator AI can extract

**Verify**: Open `en.json`, confirm `landing.hero.title` starts with "Nabeeh:".

### Step 2: Rewrite feature descriptions for extractability

In `frontend/src/messages/en.json`, replace the features section (`landing.features`):

**Before:**
```json
"features": {
  "title": "Everything you need in one place",
  "subtitle": "Stop juggling multiple tools. Nabeeh handles it all.",
  "attendance": {
    "title": "Attendance Tracking",
    "description": "Mark attendance in seconds. Track patterns and identify at-risk students automatically."
  },
  "grades": {
    "title": "Grade Management",
    "description": "Enter grades, calculate averages, and generate reports for any assessment type."
  },
  "whatsapp": {
    "title": "WhatsApp Bot",
    "description": "Parents can ask about attendance, grades, and schedules via WhatsApp — the bot answers instantly."
  },
  "communication": {
    "title": "Parent Communication",
    "description": "Send updates, reports, and announcements to parents directly through WhatsApp."
  },
  "reports": {
    "title": "Performance Reports",
    "description": "Visual dashboards showing student progress, attendance trends, and grade distributions."
  },
  "groups": {
    "title": "Multi-Group Management",
    "description": "Manage multiple classes, subjects, and student groups from a single dashboard."
  }
}
```

**After:**
```json
"features": {
  "title": "Features",
  "subtitle": "Nabeeh includes attendance tracking, grade management, WhatsApp bot, parent communication, performance reports, and multi-group management in one platform.",
  "attendance": {
    "title": "Attendance Tracking",
    "description": "Nabeeh tracks student attendance per session with present, absent, late, and excused statuses. Teachers mark attendance in bulk or individually, and the system calculates attendance rates and identifies at-risk students automatically."
  },
  "grades": {
    "title": "Grade Management",
    "description": "Nabeeh manages grades for quizzes, tests, midterms, finals, and homework. It calculates averages per student and per group, generates grade distributions, and flags students whose grades are declining."
  },
  "whatsapp": {
    "title": "WhatsApp Bot",
    "description": "Nabeeh's WhatsApp bot lets parents ask about their child's attendance, grades, and schedule. The bot queries the teacher's database and responds automatically in Arabic or English."
  },
  "communication": {
    "title": "Parent Communication",
    "description": "Nabeeh sends performance reports, attendance summaries, and announcements to parents via WhatsApp. Reports are AI-generated from real student data and can be reviewed before sending."
  },
  "reports": {
    "title": "Performance Reports",
    "description": "Nabeeh generates visual dashboards with attendance trends, grade distributions, and student performance over time. Teachers can export reports as PDF or send them to parents via WhatsApp."
  },
  "groups": {
    "title": "Multi-Group Management",
    "description": "Nabeeh supports multiple course offerings, groups, and schedules from a single dashboard. Each group has its own attendance, grades, and enrollment tracking."
  }
}
```

Key changes:
- Each description starts with "Nabeeh" (entity name for AI extraction)
- Factual statements, not marketing claims
- Specific details (statuses, assessment types, languages)
- Self-contained — each description works as a standalone answer

**Verify**: Open `en.json`, confirm all feature descriptions start with "Nabeeh".

### Step 3: Rewrite problem section for factual comparison

In `frontend/src/messages/en.json`, replace the problem section (`landing.problem`):

**After:**
```json
"problem": {
  "title": "Why tutors switch to Nabeeh",
  "subtitle": "Private tutors in Egypt typically manage attendance and grades in Excel spreadsheets and communicate with parents through scattered WhatsApp messages. Nabeeh replaces all three with one platform.",
  "points": {
    "spreadsheets": {
      "title": "Spreadsheet-based tracking",
      "description": "Most tutors use Excel or Google Sheets for attendance and grades. This leads to version conflicts, formula errors, and no real-time visibility into student performance."
    },
    "whatsapp": {
      "title": "Scattered parent messages",
      "description": "Parents message tutors across multiple WhatsApp groups and individual chats. There is no structured way to respond with attendance or grade data without manually checking records."
    },
    "tracking": {
      "title": "No student performance visibility",
      "description": "Without a centralized system, tutors cannot identify which students are falling behind, which have low attendance, or which need intervention until it is too late."
    }
  },
  "solution": {
    "title": "What Nabeeh does differently",
    "description": "Nabeeh is a bilingual (Arabic/English) teaching assistant that stores student data in one place, tracks attendance and grades in real time, and lets parents query their child's data through WhatsApp automatically."
  }
}
```

Key changes:
- Title is a factual statement, not emotional copy
- Each pain point describes a specific, verifiable problem
- Solution section is a self-contained product description
- Includes bilingual mention (differentiator)

**Verify**: Open `en.json`, confirm `landing.problem.title` starts with "Why tutors".

### Step 4: Tighten FAQ answers for citation

In `frontend/src/messages/en.json`, replace the FAQ section (`landing.faq`):

**After:**
```json
"faq": {
  "title": "Frequently asked questions",
  "subtitle": "Common questions about Nabeeh, the teaching assistant for private tutors.",
  "questions": {
    "what": {
      "question": "What is Nabeeh?",
      "answer": "Nabeeh is a bilingual (Arabic/English) teaching assistant for private tutors and tutoring centers. It manages attendance tracking, grade management, student information, and parent communication through WhatsApp — all in one platform."
    },
    "whatsapp": {
      "question": "How does the WhatsApp integration work?",
      "answer": "Parents send messages to your Nabeeh WhatsApp number asking about their child's attendance, grades, or schedule. Nabeeh queries your database and responds automatically in Arabic or English. The bot handles attendance queries, grade lookups, and schedule information."
    },
    "pricing": {
      "question": "Is Nabeeh free?",
      "answer": "Yes. Nabeeh's free tier includes up to 20 students, 1 group, attendance tracking, basic grade management, and the WhatsApp bot. Premium tiers with unlimited students, advanced reports, and multi-teacher support are coming soon."
    },
    "setup": {
      "question": "How long does it take to set up Nabeeh?",
      "answer": "Nabeeh takes about 5 minutes to set up. Create an account, add your students (or import from Excel), create groups, and connect WhatsApp. No technical knowledge is required."
    },
    "data": {
      "question": "Is my data secure on Nabeeh?",
      "answer": "Nabeeh uses encrypted data storage on Supabase (PostgreSQL). Student data is isolated per teacher and never shared with third parties. The platform uses JWT authentication and role-based access control."
    },
    "support": {
      "question": "Does Nabeeh support Arabic?",
      "answer": "Yes. Nabeeh is fully bilingual — Arabic and English. The interface, WhatsApp bot responses, and all content are available in both languages. You can switch languages at any time."
    }
  }
}
```

Key changes:
- Answers include specific details (20 students, 5 minutes, Supabase, JWT)
- Each answer is self-contained and factual
- Includes entity name "Nabeeh" in answers
- FAQ subtitle is a factual descriptor

**Verify**: Open `en.json`, confirm FAQ answers contain specific details and start with "Nabeeh" or direct facts.

### Step 5: Update Arabic translations to match

In `frontend/src/messages/ar.json`, update the matching sections (`landing.hero`, `landing.features`, `landing.problem`, `landing.faq`) with equivalent Arabic translations that follow the same AED pattern. The Arabic should be natural, not literal translations.

**Verify**: Open `ar.json`, confirm the Arabic landing sections exist and are non-empty.

### Step 6: Add CSS class for Speakable selector on Hero

In `frontend/src/components/landing/Hero.tsx`, add a `hero-subtitle` class to the subtitle `<p>` tag:

**Before (line 23):**
```tsx
<p className="text-lg text-ink/60 font-body max-w-lg leading-relaxed">
```

**After:**
```tsx
<p className="hero-subtitle text-lg text-ink/60 font-body max-w-lg leading-relaxed">
```

**Verify**: `cd frontend && npm run build` exits 0.

### Step 7: Add semantic class to FeaturesSection for AI extraction

In `frontend/src/components/landing/FeaturesSection.tsx`, add a `features-grid` class to the grid container:

**Before (line 31):**
```tsx
<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
```

**After:**
```tsx
<div className="features-grid grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
```

**Verify**: `cd frontend && npm run build` exits 0.

## Test plan

- No new unit tests — these are content and class name changes.
- Manual verification: visit `/en` and `/ar`, confirm all sections render correctly with the new text.
- Verify the hero subtitle has `class="hero-subtitle ..."` in the rendered HTML.

## Done criteria

- [ ] `en.json` hero subtitle starts with "Nabeeh is a bilingual..."
- [ ] All 6 feature descriptions in `en.json` start with "Nabeeh"
- [ ] Problem section title is "Why tutors switch to Nabeeh"
- [ ] FAQ answers contain specific details (numbers, technology names)
- [ ] `ar.json` matching sections are updated
- [ ] `Hero.tsx` subtitle `<p>` has `hero-subtitle` class
- [ ] `FeaturesSection.tsx` grid has `features-grid` class
- [ ] `npm run build` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

- The code at the locations in "Current state" doesn't match the excerpts.
- `npm run build` fails after changes.
- Arabic translations are machine-translated and unnatural — ask a human reviewer if uncertain.

## Maintenance notes

- **Content freshness**: AI engines favor recently updated content. Review landing copy quarterly.
- **A/B testing**: If conversion tracking is added later, test whether answer-first headings perform better than marketing headlines.
- **Translation sync**: Every future change to `en.json` landing sections must also update `ar.json` — add this to the PR checklist.
