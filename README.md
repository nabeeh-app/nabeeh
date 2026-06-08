# 🎓 Nabeeh - Smart Teaching Assistant

Bilingual teaching assistant for classroom management, tracking, and parent communication via WhatsApp.

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Node.js](https://img.shields.io/badge/node.js-18+-green.svg) ![React](https://img.shields.io/badge/react-18+-blue.svg) ![Supabase](https://img.shields.io/badge/supabase-enabled-green.svg)

## ⚡ Quick Start

### 1. Backend
```bash
cd backend
npm install
cp .env.example .env  # fill in Supabase, JWT, Gemini, WAHA secrets
npm start
```

### 2. Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### 3. Database
```bash
cd backend
node database/run_migration.js
node scripts/seed_test_users.js
```

## 🔐 Environment Files
- `backend/.env.example` ships with placeholder values. Copy it to `backend/.env`, populate your own Supabase, JWT, Gemini, and WhatsApp details, and **do not commit the real file**.
- `frontend/.env.example` should be copied to `frontend/.env.local`; set `NEXT_PUBLIC_API_URL` to point at your Express instance.
- Secrets and Baileys session artifacts are intentionally absent from the repository. Each developer must log in or pair a new WhatsApp session locally.

## 📱 WhatsApp Automation Status
WhatsApp monitoring + sending now run through the authenticated Express API. `/api/whatsapp/status` (GET or POST) surfaces the live Baileys socket state + QR image, `/api/whatsapp/send-*` relays teacher-triggered test messages, and `/api/whatsapp/logout` tears down the current session. Pair a fresh device locally because session files are no longer tracked in git.

## 🚦 Feature Availability (Temporary)
| Feature/Page | Status | Notes |
| --- | --- | --- |
| Login | Available | Custom JWT login works; `/api/auth/register` and profile updates are not implemented yet. |
| Registration | Available | `/api/auth/register` now hashes credentials, creates teacher settings, and returns a JWT to the UI. |
| Dashboard KPIs | Demo data | Cards use hardcoded counts; `GET /teachers/dashboard` is not wired to the UI. |
| Students | Partial | Listing fetches Supabase data, but parent columns are mocked and create payloads lack `group_id`. |
| Attendance | Partial | Frontend + API now share the `group_id` contract; pagination and advanced filtering still pending. |
| Grades | Partial | UI (and WhatsApp bot) expect denormalized `subject/percentage` fields that the API does not yet provide. |
| Messaging/Conversations | Demo UI | Dashboard/messages page renders local arrays; not connected to `/messages` routes. |
| Settings | Partial | Uses `/api/auth/profile` for teacher updates; WhatsApp setup UI still needs polish. |
| WhatsApp Monitor | Partial | `/api/whatsapp/status` is live again, but requires an active Baileys session to report “working.” |
| Courses/Schedule/Reports/Monitor | Demo UI | These admin pages show static arrays/random values only. |

## 🧪 Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@nabeeh.com | Admin123! |
| Teacher | teacher.math@nabeeh.com | Teacher123! |

## 🛠 Tech Stack
- **Frontend:** Next.js 14, React 18, Tailwind, TypeScript
- **Backend:** Express.js, Supabase, Google Gemini AI
- **Auth:** Custom JWT, Role-based access
- **WhatsApp:** Baileys (Native integration)

## 📄 License
MIT License
