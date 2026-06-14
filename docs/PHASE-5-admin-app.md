# Phase 5: Admin App (Separate Project)

## Overview
A separate Next.js project for internal admin operations: user management, subscription management, payment processing, telemetry, and support tools. Fully independent project — only shares database schema with main app.

## Prerequisites
- Phase 1 complete (migration applied — all main tables exist)
- Supabase service-role key (for admin operations bypassing RLS)
- Separate Supabase auth token system (admin users are NOT teachers)
- Deployment target: Vercel (separate project)

## Architecture
- **Separate Next.js project** at `admin/` directory root
- **Separate Vercel deployment** (admin.nabeeh.com)
- **Service-role Supabase client** — bypasses RLS for admin operations
- **Admin auth:** Separate `admin_users` table, invite-based access
- **Roles:** `super_admin`, `support_agent`, `viewer`

---

## Tasks

### Task 30: Admin Project Setup
**Directory:** `admin/` (new Next.js project)

```bash
npx create-next-app@latest admin --typescript --tailwind --app
```

**Install dependencies:**
- `@supabase/supabase-js`
- `@supabase/ssr`
- `recharts` (for charts)
- `next-intl` (bilingual support)
- `zod` (validation)

**Configure:**
- Supabase client with **service-role key** (server-side only)
- Separate auth flow (admin users table)
- Environment variables:
  ```
  NEXT_PUBLIC_SUPABASE_URL=...
  SUPABASE_SERVICE_ROLE_KEY=...
  NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY=...
  ```

---

### Task 43: Admin Database Tables
**File:** `database/migrations/004_admin_tables.sql`

```sql
-- Admin users
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'support_agent', 'viewer')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'basic', 'pro', 'center')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'expired', 'suspended', 'cancelled')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  amount_egp DECIMAL(10,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('vodafone_cash', 'instapay', 'paymob', 'fawry', 'cash')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  receipt_url TEXT,
  verified_by UUID REFERENCES admin_users(id),
  verified_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Usage Log
CREATE TABLE ai_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  tokens_used INT NOT NULL DEFAULT 0,
  model TEXT NOT NULL DEFAULT 'gemini',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support Tickets
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Audit Log
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES admin_users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**RLS:** Admin tables use `admin_users` for access control, not `auth.uid() = teacher_id`.

---

### Task 31: Admin Auth
**Files:** `admin/src/app/login/page.tsx`, `admin/src/middleware.ts`

**Login flow:**
1. Admin enters email + password
2. Authenticate against Supabase auth
3. Check `admin_users` table for role
4. If not admin user → reject
5. Store session in httpOnly cookie

**Middleware:**
- Protect all `/admin/*` routes except `/admin/login`
- Check admin session + role on every request
- Role-based access: `viewer` can only read, `support_agent` can modify, `super_admin` can do everything

---

### Task 32: Teacher List View
**File:** `admin/src/app/teachers/page.tsx`

Admin table for all teachers:
- Columns: Name, Email, Tier, Status, Students Count, Last Active, Actions
- Search by name/email
- Filter by tier, status
- Sort by any column
- Bulk actions: export CSV, bulk tier change
- Pagination

**API:** Uses service-role Supabase client to query `teachers` + `subscriptions`

---

### Task 33: Teacher Detail View
**File:** `admin/src/app/teachers/[id]/page.tsx`

Detailed teacher profile:
- Profile info (name, email, phone, subjects)
- Subscription status + history
- Usage stats (students, attendance records, grades, WhatsApp messages)
- AI token usage (per feature per day)
- Activity log (from `action_audit_log`)
- Quick actions: change tier, extend trial, suspend, send notification

---

### Task 34: Subscription Management
**File:** `admin/src/components/SubscriptionManager.tsx`

Actions on teacher subscription:
- Change tier (dropdown)
- Extend trial (date picker)
- Suspend subscription (with reason)
- Cancel subscription
- Reactivate suspended subscription

All changes logged to `admin_audit_log`.

---

### Task 35: Payment Logging
**File:** `admin/src/components/PaymentLogger.tsx`

Manual payment entry:
- Select teacher (searchable dropdown)
- Amount (EGP)
- Method (Vodafone Cash, InstaPay, Fawry, Paymob, Cash)
- Upload receipt (Supabase Storage)
- Notes

**Verification flow:**
1. Admin sees pending payment
2. Reviews receipt image
3. Clicks "Verify" → activates subscription
4. Or "Reject" → with rejection reason

---

### Task 36: Payment Queue
**File:** `admin/src/app/payments/page.tsx`

Pending payments view:
- List of payments with status `pending`
- Each row: teacher name, amount, method, date, receipt thumbnail
- Actions: Verify, Reject, View Details
- Filter by status, method, date range

---

### Task 37: Platform Metrics Dashboard
**File:** `admin/src/app/dashboard/page.tsx`

Key metrics:
- **MRR (Monthly Recurring Revenue):** Sum of active subscriptions by tier
- **User Growth:** New teachers per week/month (line chart)
- **Feature Adoption:** % using attendance, grades, WhatsApp, AI features
- **AI Usage:** Total tokens consumed, cost estimate
- **WhatsApp Volume:** Messages sent/received per day

**Charts:** Use `recharts` for all visualizations.

---

### Task 38: Per-Teacher Usage Stats
**File:** `admin/src/components/TeacherUsageStats.tsx`

Stats per teacher:
- Students count
- Attendance records this month
- Grades entered this month
- WhatsApp messages sent
- AI tokens used (by feature)
- Storage used (receipts, uploads)

**Table:** Sortable, exportable to CSV.

---

### Task 39: AI Usage Tracking Dashboard
**File:** `admin/src/app/ai-usage/page.tsx`

AI-specific metrics:
- Total tokens consumed (by day, week, month)
- Cost breakdown by teacher
- Cost breakdown by feature (reports, comments, analysis)
- Model usage (Gemini vs self-hosted if applicable)
- Budget alerts (teacher approaching daily limit)

---

### Task 40: System Health Dashboard
**File:** `admin/src/app/health/page.tsx`

Real-time system status:
- **WhatsApp:** Connection status, message queue depth, error rate
- **API:** Response times (p50, p95, p99), error rate, request volume
- **Database:** Connection count, query performance, storage usage
- **Gemini:** Token usage, error rate, latency
- **Overall:** Uptime indicator, last incident

**Auto-refresh:** Every 30 seconds.

---

### Task 41: Support Tools
**Files:** `admin/src/components/support/`

- **Manual Override:** Change any teacher setting, subscription tier, or data
- **Impersonate (read-only):** View dashboard as teacher (no mutations)
- **Send Notification:** Push notification to specific teacher(s)
- **Bulk Actions:** Bulk tier change, bulk notification

---

### Task 42: Support Ticket System
**Files:** `admin/src/app/tickets/page.tsx`, `admin/src/app/tickets/[id]/page.tsx`

Simple ticket system:
- List all tickets (filterable by status, priority)
- Assign ticket to admin agent
- Update status (open → in_progress → resolved → closed)
- Add internal notes (not visible to teacher)
- View teacher's profile and usage alongside ticket

---

## File Structure

```
admin/
├── src/
│   ├── app/
│   │   ├── login/page.tsx           # Admin login
│   │   ├── layout.tsx               # Admin shell
│   │   ├── dashboard/page.tsx       # Metrics overview
│   │   ├── teachers/
│   │   │   ├── page.tsx             # Teacher list
│   │   │   └── [id]/page.tsx        # Teacher detail
│   │   ├── payments/page.tsx        # Payment queue
│   │   ├── ai-usage/page.tsx        # AI tracking
│   │   ├── health/page.tsx          # System health
│   │   └── tickets/
│   │       ├── page.tsx             # Ticket list
│   │       └── [id]/page.tsx        # Ticket detail
│   ├── components/
│   │   ├── SubscriptionManager.tsx
│   │   ├── PaymentLogger.tsx
│   │   ├── TeacherUsageStats.tsx
│   │   └── support/
│   │       ├── ManualOverride.tsx
│   │       ├── Impersonate.tsx
│   │       └── SendNotification.tsx
│   ├── lib/
│   │   ├── supabase.ts              # Service-role client
│   │   └── admin-auth.ts            # Admin auth helpers
│   └── middleware.ts                 # Auth + role check
├── .env.local.example
└── package.json
```

## Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_ADMIN_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_MAIN_APP_URL=...
```

## Verification Checklist
- [ ] Admin project builds and deploys
- [ ] Admin login works with admin_users credentials
- [ ] Role-based access control works (viewer can't modify)
- [ ] Teacher list loads with search/filter/sort
- [ ] Teacher detail shows all stats
- [ ] Subscription management changes work + logged
- [ ] Payment queue shows pending payments
- [ ] Payment verification activates subscription
- [ ] Receipt upload/download works
- [ ] Metrics dashboard shows MRR, growth, adoption
- [ ] AI usage tracking shows token consumption
- [ ] System health shows WhatsApp/API/DB status
- [ ] Support tools work (impersonate read-only)
- [ ] Ticket system creates/assigns/resolves
- [ ] Admin audit log captures all admin actions
- [ ] `npm run lint` passes in `admin/`

## Suggested Skills
- `hallmark` — admin dashboard UI design
- `tdd` — testing admin auth and role checks
