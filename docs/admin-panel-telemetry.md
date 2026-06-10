# Admin Panel, Payments & Telemetry — Nabeeh

## Overview

Separate Next.js app deployed on its own Vercel project. Small admin team (invite-based). Manages users, subscriptions, payments, telemetry, and system health.

---

## 1. Admin App Architecture

### Tech Stack
- **Framework:** Next.js (same as main app)
- **Database:** Supabase (same project, admin client with service-role key)
- **Deployment:** Separate Vercel project (admin.nabeeh.com)
- **Auth:** Supabase Auth with admin role check
- **UI:** Tailwind + shadcn/ui (shared components with main app)

### Why Separate App
- Independent deploy cycle (admin changes don't affect main app)
- Different security context (admin uses service-role key, main app uses anon key)
- Cleaner separation of concerns
- Can be locked down to specific IPs later

### Project Structure
```
admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Dashboard overview
│   │   ├── teachers/             # User management
│   │   ├── subscriptions/        # Subscription management
│   │   ├── payments/             # Payment logging
│   │   ├── telemetry/            # Analytics dashboard
│   │   ├── health/               # System health
│   │   ├── settings/             # Admin settings
│   │   └── login/                # Admin login
│   ├── components/
│   ├── lib/
│   │   ├── supabase.ts           # Service-role client
│   │   └── api.ts                # Admin API client
│   └── types/
├── package.json
└── .env.local
```

---

## 2. Admin Access Control

### Roles

| Role | Capabilities |
|------|-------------|
| **Super Admin** | Everything. Manage admins, subscriptions, payments, system settings. |
| **Support Agent** | View teachers, log payments, view telemetry, manual overrides. Cannot manage admins or system settings. |
| **Viewer** | Read-only access to telemetry and teacher list. No mutations. |

### How It Works
- Super admin invites new admins via email
- Invite creates a record in `admin_users` table with role
- Admin logs in via Supabase Auth
- Middleware checks `admin_users` table for role on every request
- Different UI sections visible based on role

### Database Table: `admin_users`
```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'support_agent', 'viewer')),
  invited_by UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);
```

### Security
- Admin app uses service-role key (bypasses RLS)
- Admin auth tokens are separate from teacher auth tokens
- Admin sessions expire after 8 hours (shorter than teacher sessions)
- All admin actions logged to `admin_audit_log`

---

## 3. User Management (Admin)

### Teacher List View
- Table: name, email, phone, tier, status, students count, last login, created_at
- Filters: tier, status, last login date, city
- Search: by name, email, phone
- Sort: by any column

### Teacher Detail View
- Profile info (name, email, phone, business_name)
- Subscription status and history
- Payment history
- Usage stats (students, groups, offerings, attendance records, grades)
- Assistant list
- WhatsApp connection status
- Activity log (last 10 actions)
- Quick actions: change tier, disable account, reset password, send notification

### Assistant List View
- Table: assistant name, linked teachers, permissions, status, last login
- Filter: by status, by teacher

### Bulk Actions
- Export teacher list (CSV)
- Send bulk notification (email or WhatsApp)
- Bulk tier change (for migrations)

---

## 4. Subscription Management

### Subscription States

| State | Meaning |
|-------|---------|
| **active** | Currently paying (or free tier) |
| **trial** | Free trial period (14 days) |
| **past_due** | Payment missed, grace period (7 days) |
| **cancelled** | Teacher cancelled, access until period ends |
| **expired** | No longer has access |
| **suspended** | Manually suspended by admin |

### Subscription Table: `subscriptions`
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'basic', 'pro', 'center')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial', 'past_due', 'cancelled', 'expired', 'suspended')),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Admin Subscription Actions
- **Change tier:** Upgrade/downgrade immediately or at period end
- **Extend trial:** Add days to trial period
- **Grant access:** Manually activate a tier (for support cases)
- **Suspend:** Immediately revoke access
- **Cancel:** Set to cancel at period end
- **Reactivate:** Restore cancelled subscription

### Tier Limits Enforcement
- Backend checks subscription tier on every API call
- Returns 403 with `SUBSCRIPTION_LIMIT_EXCEEDED` if limit hit
- Admin can override limits per teacher (for support cases)

---

## 5. Payment Logging

### Why Manual Payments
Egypt's payment landscape:
- **Vodafone Cash:** Mobile wallet, ~30M users. Manual transfer.
- **InstaPay:** Bank transfer app. Manual.
- **Paymob:** Payment gateway (can be automated later).
- **Cash in hand:** Physical payment. Manual.

All require human verification. No fully automated billing.

### Payment Table: `payments`
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'EGP',
  method TEXT NOT NULL CHECK (method IN ('vodafone_cash', 'instapay', 'paymob', 'cash', 'bank_transfer', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected', 'refunded')),
  receipt_url TEXT,           -- Supabase Storage URL for receipt photo
  reference_number TEXT,      -- Transaction ID from payment provider
  notes TEXT,
  verified_by UUID REFERENCES admin_users(id),
  verified_at TIMESTAMPTZ,
  subscription_id UUID REFERENCES subscriptions(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Payment Flow

```
1. Teacher pays (Vodafone Cash / InstaPay / cash)
    ↓
2. Teacher sends receipt to admin (WhatsApp or in-app upload)
    ↓
3. Admin sees payment in "Pending Payments" queue
    ↓
4. Admin reviews:
   - Amount matches expected tier price?
   - Receipt looks legitimate?
   - Reference number matches?
    ↓
5. Admin clicks [Verify] or [Reject]
   - Verify: payment marked as verified, subscription activated/extended
   - Reject: payment marked as rejected, teacher notified
    ↓
6. Subscription updated:
   - If new: activate tier, set expires_at
   - If renewal: extend expires_at by 1 month/year
   - If upgrade: prorate and activate higher tier
```

### Admin Payment Queue
- Pending payments shown at top of payments page
- Filter: by method, status, date range, teacher
- Sort: by date, amount
- Bulk verify (for multiple payments at once)

### Receipt Storage
- Teachers upload receipt photos via WhatsApp or in-app
- Stored in Supabase Storage (`payments/receipts/`)
- Admin can view receipt in the payment detail view
- Receipts retained for 1 year

---

## 6. Telemetry & Analytics

### Platform-Wide Metrics (Admin Dashboard)

#### Overview Cards
- Total teachers (active / trial / expired)
- Total students
- Total assistants
- MRR (Monthly Recurring Revenue)
- Active subscriptions by tier
- WhatsApp messages sent (today / this week / this month)
- Gemini API tokens used (today / this month)

#### Charts
- **Revenue over time:** MRR trend (last 12 months)
- **User growth:** New signups vs churn (last 12 months)
- **Feature adoption:** Which features are used most (attendance, grades, WhatsApp, reports)
- **Tier distribution:** Pie chart of Free/Basic/Pro/Center users
- **AI usage:** Gemini tokens consumed per tier
- **WhatsApp volume:** Messages sent per day/week

### Per-Teacher Metrics

| Metric | Source | Granularity |
|--------|--------|-------------|
| Active students | `students` table | Current |
| Groups | `groups` table | Current |
| Attendance records | `attendance` table | Total |
| Grades entered | `grades` table | Total |
| WhatsApp messages | `messages` table | Daily |
| Gemini tokens | `ai_usage_log` table | Daily |
| API calls | Request logs | Daily |
| Storage used | Supabase Storage | Current |
| Last active | `teachers.updated_at` | Timestamp |
| Login count | `auth_audit_log` | Total |

### AI Usage Log Table: `ai_usage_log`
```sql
CREATE TABLE ai_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,           -- 'whatsapp_bot', 'report_comment', 'trend_analysis', etc.
  tokens_used INT NOT NULL,
  model TEXT DEFAULT 'gemini-flash',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Telemetry Dashboard Pages
1. **Overview:** Platform-wide metrics, charts, MRR
2. **Teachers:** Searchable teacher list with usage stats
3. **Subscriptions:** Tier distribution, churn rate, upgrade/downgrade flow
4. **Payments:** Payment history, pending queue, revenue by method
5. **AI Usage:** Token consumption by teacher, by feature, by day
6. **WhatsApp:** Message volume, bot response rate, error rate

---

## 7. System Health Monitoring

### Health Dashboard

#### WhatsApp Connection Status
- Connected / Disconnected / Reconnecting
- Last message sent timestamp
- Queue depth (messages waiting to be sent)
- Error count (last 24h)

#### API Health
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Request volume (per endpoint)
- Slow queries (>500ms)

#### Database Health
- Connection count
- Query performance
- Storage usage
- RLS policy violations (blocked queries)

#### Gemini API Health
- Request success rate
- Average response time
- Token usage vs budget
- Error rate

### Alerting (for Admin)
- WhatsApp disconnection > 5 minutes
- Error rate > 5% in last hour
- API response time > 2s (p95)
- Database storage > 80%
- Gemini budget exceeded for > 10 teachers

### Alert Delivery
- In-app notification (admin dashboard)
- Email to super admin
- WhatsApp to super admin (for critical issues)

---

## 8. Support Tools

### Manual Overrides
- **Grant trial:** Give a teacher 14-day trial of any tier
- **Override limits:** Temporarily allow more students/assistants than tier allows
- **Reset WhatsApp:** Disconnect and reconnect WhatsApp for a teacher
- **Impersonate:** View the teacher's dashboard as they see it (read-only)
- **Send notification:** Push a message to a teacher's dashboard or WhatsApp

### Support Ticket System (Simple)
```sql
CREATE TABLE support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES teachers(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES admin_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Teacher Support Flow
1. Teacher contacts support (WhatsApp or in-app)
2. Admin creates ticket (or auto-creates from WhatsApp)
3. Admin investigates (impersonate, view logs, check subscription)
4. Admin resolves (grant access, fix issue, etc.)
5. Ticket closed, teacher notified

---

## 9. Database Tables Summary (New)

| Table | Purpose | Created By |
|-------|---------|-----------|
| `admin_users` | Admin access control | Migration |
| `subscriptions` | Teacher subscription state | Migration |
| `payments` | Manual payment log | Migration |
| `ai_usage_log` | AI token consumption tracking | Migration |
| `support_tickets` | Support ticket system | Migration |
| `admin_audit_log` | Admin action audit trail | Migration |

### Modified Tables
| Table | New Columns |
|-------|------------|
| `teachers` | `subscription_tier`, `subscription_status`, `trial_ends_at` |

---

## 10. Deployment

### Admin App
- **Vercel project:** admin.nabeeh.com
- **Environment variables:** Service-role Supabase key, admin JWT secret
- **CI/CD:** Git push → auto-deploy
- **Domain:** Separate subdomain, separate SSL cert

### Security Considerations
- Admin app is NOT accessible from the main app's domain
- Admin auth tokens are separate from teacher tokens
- Service-role key only used in admin backend (never exposed to client)
- All admin actions audited
- Consider IP whitelisting for super admin access

---

## 11. Implementation Priority

### Phase 1: Foundation (Weeks 1-2)
- [ ] Admin app setup (Next.js + Supabase service-role)
- [ ] Admin auth (login, role check, middleware)
- [ ] Teacher list view (search, filter, sort)
- [ ] Teacher detail view (profile, subscription, usage)

### Phase 2: Subscriptions & Payments (Weeks 3-4)
- [ ] Subscription management (change tier, extend trial, suspend)
- [ ] Payment logging (create, verify, reject)
- [ ] Receipt upload and storage
- [ ] Payment queue (pending payments view)

### Phase 3: Telemetry (Weeks 5-6)
- [ ] Platform-wide metrics dashboard
- [ ] Per-teacher usage stats
- [ ] AI usage tracking
- [ ] Charts and graphs (revenue, user growth, feature adoption)

### Phase 4: Health & Support (Weeks 7-8)
- [ ] System health dashboard (WhatsApp, API, DB, Gemini)
- [ ] Alerting system (critical issues)
- [ ] Support ticket system
- [ ] Manual override tools (grant access, impersonate)

---

## 12. Cost Impact

| Item | Cost | Notes |
|------|------|-------|
| Vercel (admin app) | Free (hobby) | Separate project, low traffic |
| Supabase Storage (receipts) | Free (1GB) → $5/mo | Receipt photos |
| Supabase DB (new tables) | Free (500MB) → $25/mo | Small tables, shared with main DB |
| Email (admin notifications) | Free (100/day) | Resend, low volume |
| **Total additional cost** | **$0-10/mo** | |

Admin app is cheap because it's low-traffic and shares infrastructure with the main app.
