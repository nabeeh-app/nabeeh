# Nabeeh - Smart Teaching Assistant

Bilingual (AR/EN) teaching assistant for classroom management, student tracking, attendance, grade management, and parent communication via WhatsApp. Targets private tutors and tutoring centers in Egypt/MENA.

![License](https://img.shields.io/badge/license-MIT-blue.svg) ![Node.js](https://img.shields.io/badge/node.js-18+-green.svg) ![React](https://img.shields.io/badge/react-19+-blue.svg) ![Supabase](https://img.shields.io/badge/supabase-enabled-green.svg)

## Quick Start

### Prerequisites
- Node.js 18+
- Supabase account (database + auth)
- Gemini API key (for WhatsApp bot AI responses)

### 1. Database
```bash
cd database
node run_migration.js
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env  # Fill in Supabase, JWT, Gemini secrets
npm run dev            # Starts with Nodemon (hot reload)
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev            # Starts with Turbopack
```

### Quick Start (all-in-one)
```bash
./dev.sh start         # Start both services with health checks
./dev.sh status        # Check PIDs, memory, health
./dev.sh stop          # Graceful shutdown
./dev.sh logs          # Tail all logs
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind v4, TypeScript |
| Backend | Express 5, Node.js |
| Database | Supabase/PostgreSQL |
| Auth | JWT (httpOnly cookies), RBAC |
| WhatsApp | Baileys (native integration) |
| AI Bot | Gemini AI |
| Testing | Jest + Supertest (backend), Vitest (frontend) |

## Project Structure

```
nabeeh/
├── backend/                    # Express API
│   ├── server.js               # Entry point
│   ├── config/database.js      # Supabase clients
│   ├── middleware/              # Auth, security, error handling
│   ├── routes/                 # API endpoints
│   │   ├── auth.js             # Login, register, password reset
│   │   ├── students.js         # CRUD + enrollment chain
│   │   ├── attendance.js       # Mark + query
│   │   ├── grades.js           # CRUD + bulk + stats
│   │   └── ...
│   └── lib/                    # Auth, WhatsApp, logger
├── frontend/                   # Next.js app
│   └── src/
│       ├── app/[locale]/       # Locale-segmented routes
│       ├── components/         # React components
│       │   └── ui/             # Shared components
│       ├── hooks/              # useAuth, useWhatsAppStatus
│       ├── lib/                # API client, utils
│       ├── messages/           # i18n translations (en.json, ar.json)
│       └── types/              # TypeScript interfaces
├── database/
│   └── migrations/             # SQL migrations
└── docs/adr/                   # Architecture Decision Records
```

## Environment Variables

### Backend (`backend/.env`)
```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h

# Gemini AI
GEMINI_API_KEY=your_gemini_key

# Server
PORT=5000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_USE_MOCK=false
```

## Testing

### Backend (Jest + Supertest)
```bash
cd backend
npm test                # Run all tests
```

### Frontend (Vitest)
```bash
cd frontend
npm run test            # Run all tests
npm run test:watch      # Watch mode
```

## API Endpoints

### Auth
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/register` - Create teacher account
- `GET /api/auth/verify-token` - Verify JWT validity
- `GET /api/auth/me` - Get current user profile
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/request-reset` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token

### Students
- `GET /api/students` - List students (paginated, filtered)
- `GET /api/students/:id` - Get student details
- `POST /api/students` - Create student + enroll in group
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Remove student from classes
- `GET /api/students/:id/stats` - Get attendance + academic stats

### Attendance
- `GET /api/attendance` - Get attendance records (date range)
- `POST /api/attendance` - Mark attendance (bulk)
- `GET /api/attendance/summary` - Get attendance summary

### Grades
- `GET /api/grades` - Get grades (filtered)
- `POST /api/grades` - Create grade
- `POST /api/grades/bulk` - Bulk create grades
- `PUT /api/grades/:id` - Update grade
- `DELETE /api/grades/:id` - Delete grade
- `GET /api/grades/stats` - Get grade statistics

## Domain Language

| Term | Definition |
|------|-----------|
| **Teacher** | Account holder who manages students |
| **Student** | Learner enrolled in a teacher's offering |
| **Parent** | Contact linked to one or more students |
| **Offering** | A course: (teacher + subject + grade_level + academic_year) |
| **Group** | Cohort of students within an offering |
| **Enrollment** | Link between a student and a group |
| **Assessment** | Graded event (midterm, quiz, homework, final) |
| **Grade** | A student's score on a specific assessment |
| **Session** | A single class meeting where attendance is recorded |

## License

MIT License
