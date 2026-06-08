# 0005 — API consistency and validation

**Status:** Implemented

All backend routes use Zod for input validation. API responses follow a standard envelope: `{ success: true, data: ... }` for success, `{ success: false, message: '...', code: '...' }` for errors. Dead code is removed in one pass: empty `aiServices.js`, unused `LoginForm.tsx`, empty `contexts/` directory, abandoned queries in parents.js, duplicate routes in whatsapp.js. The error handler is rewritten to handle PostgreSQL/Supabase errors (unique violation, foreign key violation, invalid UUID, row-not-found) instead of Mongoose errors. Per-page error boundaries are added to each dashboard route so a single page crash does not take down the entire dashboard.

**Considered alternatives:**
- Joi for validation: rejected because Zod has better TypeScript integration and is more modern
- Root-only error boundary: rejected because one broken page should not kill the whole dashboard
- Keeping dead code: rejected because it creates confusion for anyone reading the codebase
