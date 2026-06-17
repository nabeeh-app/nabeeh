# AEO Test Checklist

Manual testing for AI citation visibility. Run monthly or after landing page changes.

## How to test

1. Open each platform
2. Paste the prompt exactly
3. Record the result in the table below

---

## ChatGPT (free tier at chatgpt.com)

| # | Prompt | Result | Nabeeh mentioned? | Link? |
|---|--------|--------|-------------------|-------|
| 1 | "What's the best tool for private tutors in Egypt to manage attendance?" | | | |
| 2 | "How to manage attendance for tutoring students?" | | | |
| 3 | "Best WhatsApp bot for parent communication in schools?" | | | |
| 4 | "Recommend a bilingual teaching assistant app" | | | |
| 5 | "Nabeeh app for tutors — is it any good?" | | | |

## Perplexity (perplexity.ai)

| # | Prompt | Result | Nabeeh mentioned? | Link? |
|---|--------|--------|-------------------|-------|
| 1 | "Nabeeh teaching assistant" | | | |
| 2 | "attendance tracking app for private tutors" | | | |
| 3 | "bilingual tutoring management software Egypt" | | | |
| 4 | "WhatsApp bot for school parent communication" | | | |

## Google AI Overview

Search these on google.com and check if Nabeeh appears in the AI Overview box at the top:

| # | Query | AI Overview shown? | Nabeeh cited? |
|---|-------|-------------------|---------------|
| 1 | best attendance tracking for tutors | | |
| 2 | WhatsApp bot for parent school communication | | |
| 3 | tutoring management software Egypt | | |
| 4 | bilingual teaching assistant app | | |

## Claude (claude.ai)

| # | Prompt | Result | Nabeeh mentioned? | Link? |
|---|--------|--------|-------------------|-------|
| 1 | "recommend a bilingual teaching assistant for Egypt" | | | |
| 2 | "what tools do private tutors use for attendance?" | | | |

---

## Scoring

| Symbol | Meaning |
|--------|---------|
| ✅ | Cited by name with link to nabeeh.app |
| ⚡ | Mentioned by name, no link |
| ❌ | Not mentioned |
| 🏆 | Competitor mentioned instead (note which one) |

## Results log

| Date | Platform | Prompt | Result | Notes |
|------|----------|--------|--------|-------|
| | | | | |
| | | | | |

---

## What to improve based on results

- **Not cited anywhere**: Check if JSON-LD is rendering (run `bash scripts/seo-test.sh`), verify content has entity-first phrasing
- **Cited on Perplexity but not ChatGPT**: Perplexity favors structured content; ChatGPT favors authority signals. Add more factual claims.
- **Competitor cited instead**: Note which competitor. Check their landing page for patterns we're missing.
- **Cited without link**: Good start. Add clearer CTAs or brand mentions to increase link probability.
