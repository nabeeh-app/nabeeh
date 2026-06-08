# 0003 — WhatsApp bot architecture and tiers

The WhatsApp bot supports two response modes that may map to different paid tiers: (1) pattern-matching with direct DB queries for structured queries (attendance, grades), falling back to Gemini AI for free-form questions, and (2) AI-first where Gemini decides whether to call DB tools or respond conversationally. Both modes share the same DB query layer. The bot is split into separate service modules: `messageParser.js` (pattern matching), `aiResponder.js` (Gemini integration), and `whatsappQuery.js` (DB queries for attendance/grades). The Gemini API key is passed via the `x-goog-api-key` header, not URL query params. Marketing messages to unregistered numbers are configurable via env vars (`WHATSAPP_MARKETING_PHONE`, `WHATSAPP_MARKETING_URL`), not hardcoded.

**Considered alternatives:**
- Monolithic whatsapp.js: rejected because the file already has 500+ lines and mixed concerns
- AI-only: rejected because it's slow and expensive for simple grade lookups
