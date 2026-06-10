# 0007 — AI, agentic features, and automation strategy

**Status:** Accepted

AI features are tiered by subscription. Basic tier gets pattern matching + basic Gemini responses. Pro tier gets AI with DB tools (function calling), personalized parent messages, trend detection, and scheduled reports. Center tier gets business intelligence.

WhatsApp bot uses Gemini function calling (not RAG) because the data is structured — attendance, grades, and enrollment records don't need vector search. Gemini was chosen over OpenAI for better Arabic language support, which is critical for the Egypt/MENA market.

Alerts and reports run on cron schedules (not real-time streams) for predictable costs and simpler debugging. Each teacher gets a daily Gemini token budget based on their tier to prevent abuse.

Reports are generated on-demand (Basic) or scheduled (Pro). PDF generation uses `@react-pdf/renderer` or Puppeteer. Image generation for WhatsApp uses `@napi-rs/canvas`. Scheduled generation uses `node-cron` or Supabase `pg_cron`.

Parent notifications use a template+AI hybrid: Basic tier fills template variables, Pro tier calls Gemini with student context to generate personalized messages. Delivery channels: in-app (free), WhatsApp (Baileys), email (Resend, last resort).

**Considered alternatives:**
- RAG with vector DB: rejected because the data is structured relational data, not unstructured documents
- OpenAI GPT: rejected because Gemini has better Arabic support and is cheaper at scale
- Real-time streaming alerts: rejected because cron is simpler, more predictable, and easier to debug
- Email-only delivery: rejected because tutors and parents in Egypt primarily use WhatsApp

**Consequences:**
- Gemini API costs scale linearly with Pro users (~$2/user/month)
- Need to implement per-teacher token budgeting to prevent cost overruns
- Cron jobs need monitoring — a failed cron silently stops alerts
- PDF/image generation needs a headless browser or canvas library — increases backend memory usage
- The `messages` table will grow fast with automated notifications — plan for archival
