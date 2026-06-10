# Deployment Comparison — Nabeeh

## Stack Recap

| Layer | Tech | Notes |
|-------|------|-------|
| Frontend | Next.js 16 + React 19 + Tailwind v4 | Static + SSR, locale routing |
| Backend | Express 5 + Node 20 | REST API, JWT auth, Baileys WhatsApp |
| Database | Supabase (PostgreSQL) | Auth, storage, realtime, RLS |
| AI | Gemini API | WhatsApp bot responses |
| WhatsApp | Baileys | Socket-based, needs persistent process |

---

## Option 1: Vercel + Railway (Recommended)

| Component | Service | Cost (est.) | Notes |
|-----------|---------|-------------|-------|
| Frontend | Vercel | Free (hobby) → $20/mo (pro) | Auto-deploy from git, edge functions, ISR |
| Backend | Railway | $5/mo (starter) → $20/mo (pro) | Persistent process for Baileys, WebSocket support |
| Database | Supabase | Free (2 projects) → $25/mo (pro) | Already in use |
| WhatsApp | Railway (same backend) | included | Baileys runs as part of backend process |
| AI | Gemini API | Pay-per-use | Free tier: 60 req/min, paid: $0.00125/1K tokens |
| Domain | Cloudflare | ~$10/year | .com or .co.uk |
| Email | Resend | Free (100/day) → $20/mo | Invite emails, password reset |

**Total estimated:** $10–65/mo

**Pros:**
- Cheapest option for solo dev
- Vercel is the best Next.js hosting (zero config)
- Railway handles persistent processes well (Baileys needs this)
- Easy scaling — Railway autoscales vertically
- Git-based deploys for both frontend and backend

**Cons:**
- Railway cold starts can take 10-30s on hobby plan
- Baileys WebSocket may disconnect on Railway deploys (need graceful reconnect)
- No built-in monitoring beyond basic logs
- Supabase free tier has 500MB database limit

**Verdict:** Best for MVP and early users. Scale to Option 2 when revenue justifies it.

---

## Option 2: Vercel + VPS (DigitalOcean/Hetzner)

| Component | Service | Cost (est.) | Notes |
|-----------|---------|-------------|-------|
| Frontend | Vercel | Free → $20/mo | Same as Option 1 |
| Backend | VPS (Hetzner CX22) | €4.50/mo (~$5) | 2 vCPU, 4GB RAM, Ubuntu |
| Database | Supabase | Free → $25/mo | Same as Option 1 |
| WhatsApp | VPS (same backend) | included | Baileys runs as systemd service |
| AI | Gemini API | Pay-per-use | Same as Option 1 |
| Domain | Cloudflare | ~$10/year | Same as Option 1 |
| Email | Resend | Free → $20/mo | Same as Option 1 |
| Monitoring | UptimeRobot | Free | Basic uptime checks |

**Total estimated:** $10–60/mo

**Pros:**
- Full control over server (install anything, any port)
- Hetzner is cheapest for the specs (€4.50/mo for 4GB RAM)
- No cold starts — process is always running
- Can run multiple services (backend + Baileys + cron jobs)
- SSH access for debugging

**Cons:**
- You manage everything: OS updates, security patches, SSL, backups
- No auto-scaling — manual upgrade needed
- Need to set up Nginx/Caddy reverse proxy, Let's Encrypt SSL
- Need to monitor your own server (UptimeRobot, Grafana, etc.)
- Hetzner is EU-based — higher latency for Egyptian users

**Verdict:** Best if you want full control and cheapest long-term. Good for a dev who enjoys ops.

---

## Option 3: AWS (EC2/Lambda + RDS)

| Component | Service | Cost (est.) | Notes |
|-----------|---------|-------------|-------|
| Frontend | Vercel or S3+CloudFront | Free tier → $20/mo | S3 is cheaper but more setup |
| Backend | EC2 t3.small or Lambda | $15/mo (EC2) or pay-per-use | Lambda is tricky with Baileys (long-lived connections) |
| Database | Supabase or RDS | $15/mo (RDS t3.micro) | RDS gives full Postgres control |
| WhatsApp | EC2 (same) or ECS Fargate | included | Fargate: $15-30/mo for persistent process |
| AI | Gemini API | Pay-per-use | Same |
| Domain | Route 53 | $0.50/mo + $10/year | Same |
| Email | SES | $0.10/1000 emails | Cheapest email at scale |
| Monitoring | CloudWatch | Free tier → $5/mo | Built-in AWS monitoring |

**Total estimated:** $30–100/mo

**Pros:**
- Industry standard, scales to millions
- CloudWatch gives deep monitoring
- SES is cheapest email at scale
- Can use ECS Fargate for Baileys (no server management)
- Lambda for lightweight API routes (but Baileys doesn't fit)

**Cons:**
- Most expensive at low scale
- Steep learning curve if you're not familiar with AWS
- Baileys needs persistent WebSocket — Lambda is stateless, doesn't work well
- Overkill for a tutoring app with <1000 users
- AWS billing can surprise you (data transfer costs, etc.)

**Verdict:** Only consider if you expect >10K concurrent users or need enterprise compliance.

---

## Option 4: Cloudflare Pages + Supabase Edge Functions

| Component | Service | Cost (est.) | Notes |
|-----------|---------|-------------|-------|
| Frontend | Cloudflare Pages | Free (unlimited) | Faster than Vercel in MENA region |
| Backend | Supabase Edge Functions | Free (500K invocations) | Deno-based, cold starts |
| Database | Supabase | Free → $25/mo | Same |
| WhatsApp | Problem | — | Baileys needs a persistent Node.js process — Edge Functions are stateless |
| AI | Gemini API | Pay-per-use | Same |

**Total estimated:** $0–30/mo (but WhatsApp doesn't fit)

**Pros:**
- Cheapest option by far
- Cloudflare Pages is fastest in MENA/Egypt (CDN nodes in Cairo)
- Supabase Edge Functions are free at low usage
- No server to manage

**Cons:**
- **Baileys doesn't work** — it needs a persistent Node.js process with WebSocket. Edge Functions are stateless.
- Would need to split WhatsApp into a separate service (Railway/VPS) — adds complexity
- Edge Functions use Deno, not Node.js — different runtime
- Less flexibility for custom middleware

**Verdict:** Only if you drop Baileys and use the WhatsApp Cloud API instead (which requires Meta Business verification — harder to set up).

---

## Recommendation

**Start with Option 1 (Vercel + Railway).** It's the cheapest, easiest, and fastest to ship. When you hit $500/mo in revenue, evaluate Option 2 (VPS) for cost savings or Option 3 (AWS) for scale.

The key constraint is Baileys — it needs a persistent Node.js process with WebSocket. This eliminates serverless options (Lambda, Edge Functions) unless you switch to the WhatsApp Cloud API.

---

## Cost Summary (Egypt Context)

| Month | Option 1 | Option 2 | Option 3 | Option 4 |
|-------|----------|----------|----------|----------|
| 1-3 (MVP) | $10-20 | $10-15 | $30-50 | $0-10* |
| 4-6 (Growth) | $20-40 | $15-25 | $50-80 | $10-30* |
| 7-12 (Scale) | $40-65 | $25-40 | $80-100 | $30-50* |

*Option 4 costs increase if WhatsApp needs a separate service.

**Break-even point:** At ~$20/mo subscription revenue, Option 1 is self-sustaining. At ~$100/mo revenue, Option 2 saves you $15-20/mo over Option 1.
