# Monetization & Pricing — Nabeeh (Egypt Focus)

## Market Context: Egypt/MENA

### Private Tutoring Market in Egypt
- **Market size:** ~$2.8B annually (Egypt is the largest tutoring market in MENA)
- **Target users:** Private tutors (individual) and tutoring centers (small businesses)
- **Average tutor income:** EGP 5,000–20,000/mo ($100–400 USD)
- **Average center revenue:** EGP 50,000–200,000/mo ($1,000–4,000 USD)
- **Price sensitivity:** Very high. Most tutors won't pay >$15/mo for software.
- **Payment methods:** Vodafone Cash, Fawry, credit cards (limited), bank transfer
- **Competition:** Notion, Google Sheets, WhatsApp groups, local apps (Teacher's Buddy, Classera)

### What Tutors Currently Pay For
- WhatsApp Business: Free
- Google Sheets: Free
- Printing attendance sheets: ~EGP 50/mo
- Typing reports manually: Time cost (2-3 hrs/week)
- **Total current cost: ~$0-5/mo** (mostly time, not money)

### Willingness to Pay
- **Individual tutors:** EGP 100–300/mo ($2–6 USD) for something that saves time
- **Tutoring centers:** EGP 500–1,500/mo ($10–30 USD) for multi-teacher management
- **Sweet spot:** Must be cheaper than hiring an assistant (EGP 2,000–3,000/mo)

---

## Pricing Tiers

### Tier 1: Free
**Target:** Individual tutors trying the product

| Feature | Limit |
|---------|-------|
| Teachers | 1 |
| Students | 30 |
| Groups | 3 |
| Offerings | 2 |
| Assistants | 0 |
| WhatsApp bot | Basic (pattern matching only) |
| Reports | Manual (dashboard only) |
| Parent notifications | Manual only |
| Storage | 100MB |
| Support | Community only |

**Purpose:** Acquisition funnel. Get tutors hooked on the product.

---

### Tier 2: Basic — EGP 99/mo (~$2 USD)
**Target:** Individual tutors who want automation

| Feature | Limit |
|---------|-------|
| Teachers | 1 |
| Students | 100 |
| Groups | 10 |
| Offerings | 5 |
| Assistants | 2 |
| WhatsApp bot | Pattern matching + basic AI |
| Reports | On-demand via WhatsApp |
| Parent notifications | Template-based (exam reminders, attendance alerts) |
| Alerts | Teacher-defined thresholds (attendance < 70%, grade < 50%) |
| Storage | 500MB |
| Support | Email |

**Revenue driver:** This is the volume tier. Most users should land here.

---

### Tier 3: Pro — EGP 249/mo (~$5 USD)
**Target:** Serious tutors and small centers

| Feature | Limit |
|---------|-------|
| Teachers | 1 (+ 1 center owner account) |
| Students | 300 |
| Groups | 30 |
| Offerings | 15 |
| Assistants | 5 |
| WhatsApp bot | Full AI (Gemini-powered insights) |
| Reports | On-demand + scheduled auto-generation |
| Parent notifications | AI-personalized messages |
| Alerts | Thresholds + AI-detected patterns |
| Audit log | Full action audit trail |
| Google login | Yes |
| Storage | 2GB |
| Support | Priority email |

**Revenue driver:** This is the profit tier. AI features justify the price jump.

---

### Tier 4: Center — EGP 599/mo (~$12 USD)
**Target:** Tutoring centers with multiple teachers

| Feature | Limit |
|---------|-------|
| Teachers | 5 |
| Students | 1,000 |
| Groups | 100 |
| Offerings | 50 |
| Assistants | 15 |
| WhatsApp bot | Full AI per teacher |
| Reports | All generation modes |
| Parent notifications | All modes |
| Alerts | All alert types |
| Audit log | Full |
| Center dashboard | Yes (see all teachers' stats) |
| Storage | 10GB |
| Support | WhatsApp support |

**Revenue driver:** This is the scale tier. Centers have budget and need multi-teacher features.

---

## Egypt-Specific Pricing Strategy

### Why EGP Pricing Matters
- Tutors think in EGP, not USD
- USD pricing feels expensive and foreign
- Local pricing builds trust
- Payment gateways (Fawry, Vodafone Cash) only work with EGP

### Payment Integration Priority
1. **Vodafone Cash** — Most popular mobile wallet in Egypt. ~30M users.
2. **Fawry** — 250K+ payment outlets. Cash payment for unbanked users.
3. **Credit cards** — Visa/Mastercard. Growing but still limited (~20% of population).
4. **Bank transfer** — For centers paying annual plans.

### Annual Discount
- Monthly: Full price
- Annual: 2 months free (pay for 10, get 12)
- Annual Basic: EGP 990 (~$20) — saves EGP 198
- Annual Pro: EGP 2,490 (~$50) — saves EGP 498
- Annual Center: EGP 5,990 (~$120) — saves EGP 1,198

---

## Cost Analysis (Your Costs per User)

### Per-User Cost Breakdown (Pro tier)

| Cost Item | Monthly Cost | Notes |
|-----------|-------------|-------|
| Supabase (DB + Auth) | ~$0.05 | Shared across all users, ~$25/mo ÷ 500 users |
| Railway (backend) | ~$0.10 | Shared across all users, ~$50/mo ÷ 500 users |
| Vercel (frontend) | ~$0.02 | Shared, ~$20/mo ÷ 1000 users |
| Gemini API (AI) | ~$0.30 | ~30 requests/day × $0.001/1K tokens × 30 days |
| Resend (email) | ~$0.02 | ~5 emails/user/month |
| Baileys (WhatsApp) | $0 | Free, self-hosted |
| **Total per-user cost** | **~$0.49/mo** | |

### Margin Analysis

| Tier | Price | Cost | Margin | Margin % |
|------|-------|------|--------|----------|
| Free | $0 | ~$0.10 | -$0.10 | N/A |
| Basic | $2 | ~$0.30 | $1.70 | 85% |
| Pro | $5 | ~$0.49 | $4.51 | 90% |
| Center | $12 | ~$1.50 | $10.50 | 88% |

**Key insight:** Your costs are almost entirely fixed (server, Supabase). Per-user costs are negligible. Revenue scales linearly while costs stay flat until you hit resource limits.

---

## Revenue Projections (Egypt Market)

### Conservative (Year 1)

| Month | Free Users | Basic | Pro | Center | MRR |
|-------|-----------|-------|-----|--------|-----|
| 1-3 | 100 | 10 | 2 | 0 | $30 |
| 4-6 | 300 | 30 | 8 | 1 | $112 |
| 7-9 | 600 | 60 | 15 | 3 | $237 |
| 10-12 | 1,000 | 100 | 25 | 5 | $435 |

**Year 1 total: ~$2,500**

### Optimistic (Year 1)

| Month | Free Users | Basic | Pro | Center | MRR |
|-------|-----------|-------|-----|--------|-----|
| 1-3 | 200 | 25 | 5 | 1 | $77 |
| 4-6 | 800 | 80 | 20 | 5 | $315 |
| 7-9 | 2,000 | 200 | 50 | 12 | $960 |
| 10-12 | 5,000 | 500 | 100 | 25 | $2,375 |

**Year 1 total: ~$14,000**

### Break-Even Analysis
- **Monthly costs (MVP):** ~$50/mo (Vercel + Railway + Supabase)
- **Break-even point:** ~15 Basic users or ~7 Pro users
- **Time to break-even:** Month 2-3 (conservative), Month 1 (optimistic)

---

## Competitive Pricing Comparison

| Product | Price | Market | Notes |
|---------|-------|--------|-------|
| Teacher's Buddy (Egypt) | Free / EGP 50/mo | Egypt | Basic attendance, no AI |
| Classera (MENA) | $5-15/user/mo | MENA | Enterprise LMS, overkill for tutors |
| Google Classroom | Free | Global | No WhatsApp integration |
| Notion | Free / $8/mo | Global | Generic, no education features |
| Teachable | $39/mo | Global | Online courses, not tutoring |
| **Nabeeh** | **$2-12/mo** | **Egypt** | **WhatsApp-first, AI-powered, bilingual** |

**Nabeeh's advantage:** WhatsApp-first (tutors already live there), bilingual AR/EN, AI-powered insights, Egypt-specific pricing.

---

## Feature Gating by Tier (AI/Agentic)

| Feature | Free | Basic | Pro | Center |
|---------|------|-------|-----|--------|
| WhatsApp bot (pattern matching) | ✅ | ✅ | ✅ | ✅ |
| WhatsApp bot (AI responses) | ❌ | ✅ | ✅ | ✅ |
| On-demand reports (WhatsApp) | ❌ | ✅ | ✅ | ✅ |
| Scheduled auto-reports | ❌ | ❌ | ✅ | ✅ |
| AI-personalized parent messages | ❌ | ❌ | ✅ | ✅ |
| Teacher-defined alerts | ❌ | ✅ | ✅ | ✅ |
| AI-detected patterns | ❌ | ❌ | ✅ | ✅ |
| Automated parent notifications | ❌ | ✅ (template) | ✅ (AI) | ✅ (AI) |
| Proactive student alerts | ❌ | ❌ | ✅ | ✅ |
| Center dashboard | ❌ | ❌ | ❌ | ✅ |

---

## Recommendations

1. **Launch with Free + Basic only.** Don't build Pro/Center features until you have 50+ Basic users.
2. **Payment gateway:** Start with Vodafone Cash + Fawry. Credit cards can come later.
3. **Annual plans:** Offer from day 1. They improve cash flow and reduce churn.
4. **Referral program:** Give 1 month free for every tutor who refers a paying user. Tutors know other tutors.
5. **University partnerships:** Partner with education faculties (Cairo University, Ain Shams). Students become users after graduation.
6. **Don't compete on price.** Compete on WhatsApp integration + AI insights. Tutors will pay for something that actually saves them time.
