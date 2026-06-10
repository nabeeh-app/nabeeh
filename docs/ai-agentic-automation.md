# AI, Agentic & Automation Features — Nabeeh

## Overview

This document covers all AI-powered, agentic (autonomous), and automation features for Nabeeh. Features are organized by tier availability and implementation priority.

---

## 1. WhatsApp Bot Intelligence (Existing + Enhanced)

### Current State
- Pattern matching for structured queries (attendance, grades)
- Gemini AI for free-form responses
- `messageParser.js` (patterns) → `aiResponder.js` (Gemini) → `whatsappQuery.js` (DB)

### Enhanced Tiers

| Capability | Basic | Pro | Center |
|-----------|-------|-----|--------|
| Pattern matching (attendance lookup) | ✅ | ✅ | ✅ |
| Pattern matching (grade lookup) | ✅ | ✅ | ✅ |
| AI free-form responses | ✅ | ✅ | ✅ |
| AI with DB tools (proactive) | ❌ | ✅ | ✅ |
| Multi-language detection (AR/EN) | ✅ | ✅ | ✅ |
| Conversation context (last 5 msgs) | ❌ | ✅ | ✅ |
| Sentiment detection (parent frustrated?) | ❌ | ✅ | ✅ |

### How It Works (Pro Tier)

```
Parent: "How is Ahmed doing?"
    ↓
messageParser.js — no pattern match
    ↓
aiResponder.js — Gemini with tools:
  - getStudentAttendance(student_name, period)
  - getStudentGrades(student_name, subject)
  - getOverallPerformance(student_name)
    ↓
Gemini decides: call getStudentAttendance + getStudentGrades
    ↓
DB query → results returned to Gemini
    ↓
Gemini generates natural language response:
  "Ahmed's attendance this month is 85% (missed 2 sessions).
   His last quiz score was 78/100. He's performing well in
   algebra but needs more practice in geometry."
    ↓
WhatsApp reply to parent
```

### Sentiment Detection (Pro)

When parent messages contain frustration indicators (caps, exclamation marks, words like "ليه", "إزاي", "مش عارف"), the bot:
1. Flags the conversation as "needs attention"
2. Notifies the teacher: "Parent of Ahmed seems frustrated"
3. Offers to escalate: "Would you like me to respond differently or should you handle this?"

---

## 2. Auto-Generated Reports

### Report Types

#### Student Report Card
- Grades per assessment
- Attendance summary
- Class rank (optional)
- Teacher comments (AI-generated or manual)

#### Class Performance Report
- Average/median/std dev per assessment
- Attendance distribution
- Top performers, at-risk students
- Topic-wise performance breakdown

#### Parent Digest
- Weekly/monthly summary for one student
- Sent via WhatsApp as text or image

### Generation Modes (Configurable per Tier)

| Mode | Basic | Pro | Center |
|------|-------|-----|--------|
| On-demand via WhatsApp ("Send me Ahmed's report") | ✅ | ✅ | ✅ |
| Teacher clicks "Generate" in dashboard → download PDF | ✅ | ✅ | ✅ |
| Scheduled auto-generation (weekly/monthly) | ❌ | ✅ | ✅ |
| Auto-send to parents | ❌ | ✅ | ✅ |
| AI-written teacher comments | ❌ | ✅ | ✅ |

### Report Generation Pipeline

```
Trigger: Teacher clicks "Generate" / scheduled cron / WhatsApp request
    ↓
1. Fetch data: grades, attendance, assessments for student/group
    ↓
2. Compute stats: average, rank, attendance %, trend
    ↓
3. AI comment generation (Pro):
   "Ahmed shows strong improvement in algebra (+15% over 3 weeks).
    Attendance has been consistent. Consider extra geometry practice."
    ↓
4. Format: PDF (dashboard) or image/text (WhatsApp)
    ↓
5. Deliver: download link / WhatsApp message / email attachment
```

### Technical Implementation
- PDF generation: `@react-pdf/renderer` or `puppeteer` (server-side)
- Image generation: `@napi-rs/canvas` or HTML-to-image
- Scheduled generation: `node-cron` in backend or Supabase pg_cron
- Storage: Supabase Storage (free tier: 1GB)

---

## 3. Proactive Student Alerts

### Alert Types

| Alert | Trigger | Default Threshold | Configurable? |
|-------|---------|-------------------|---------------|
| Attendance drop | Attendance % < threshold | 70% | ✅ |
| Grade decline | Grade < threshold | 50% | ✅ |
| Consecutive absences | Missing N sessions | 3 | ✅ |
| Performance trend | AI detects downward trend | 3-week decline | ✅ (Pro only) |
| New enrollment gap | Group has empty seats | — | ❌ (informational) |

### Alert Delivery

| Channel | Basic | Pro | Center |
|---------|-------|-----|--------|
| In-app notification | ✅ | ✅ | ✅ |
| WhatsApp to teacher | ❌ | ✅ | ✅ |
| Email digest (daily/weekly) | ❌ | ✅ | ✅ |
| WhatsApp to parent (warning) | ❌ | ❌ | ✅ (opt-in) |

### Alert Configuration (Teacher Settings)

```json
{
  "alerts": {
    "attendance_threshold": 70,
    "grade_threshold": 50,
    "consecutive_absences": 3,
    "notify_via": ["in_app", "whatsapp"],
    "digest_frequency": "daily",
    "ai_trend_detection": true
  }
}
```

### How Threshold Alerts Work

```
Daily cron job (2:00 AM):
  1. For each offering → group → enrollment:
     - Calculate attendance % for last 30 days
     - Calculate average grade for last assessment
     - Count consecutive absences
  2. If any threshold breached:
     - Create alert record in DB
     - Send in-app notification
     - If Pro+: queue WhatsApp message to teacher
     - If Pro+: queue email digest
  3. Log to action_audit_log
```

### AI Trend Detection (Pro)

```
Weekly analysis (Sunday 6:00 AM):
  For each active student:
    1. Fetch last 6 weeks of attendance + grades
    2. Calculate trend direction (improving / stable / declining)
    3. If declining:
       - Flag as "at-risk"
       - Generate AI summary: "Ahmed's grades dropped from 82% to 65%
         over 3 weeks. Attendance also declined from 95% to 78%.
         Consider: parent meeting, extra tutoring, or topic review."
    4. Send to teacher via configured channels
```

---

## 4. Automated Parent Notifications

### Notification Types

| Type | Trigger | Content | Tier |
|------|---------|---------|------|
| Exam reminder | 3 days before assessment | "Midterm exam next week for Math Grade 10" | Basic (template) |
| Report card ready | After teacher generates report | "Ahmed's report card is ready" | Basic (template) |
| Attendance warning | Attendance < 70% | "Ahmed has missed 4 sessions this month" | Basic (template) |
| Performance summary | Weekly/monthly | AI-written digest per student | Pro (AI) |
| Fee reminder | Configurable date | "Payment due for next month" | Center (template) |
| Greeting | Eid, start of term | "Happy Eid! New term starts Jan 15" | Pro (AI) |

### Message Personalization (Pro)

**Template mode (Basic):**
```
"Dear parent of {student_name},
 {student_name}'s attendance this month is {attendance}%.
 Please ensure regular attendance."
```

**AI-personalized mode (Pro):**
```
"Dear Mr. {parent_name},
 I wanted to share that {student_name} scored {score}% on
 the {assessment_name}. This is {improvement} compared to
 last time. {ai_comment}
 Keep up the great work!"
```

Where `ai_comment` is generated by Gemini based on the student's full context.

### Automation Pipeline

```
Trigger: Cron schedule / event (grade entered, attendance marked)
    ↓
1. Check notification preferences (teacher_settings)
    ↓
2. Filter: does this event trigger a notification?
    ↓
3. Compose message:
   - Basic: fill template variables
   - Pro: call Gemini with student context → generate personalized message
    ↓
4. Send via WhatsApp (Baileys)
    ↓
5. Log to messages table + action_audit_log
    ↓
6. Update conversation.last_message_at
```

---

## 5. Business Intelligence Agent (Center Tier)

### Features

| Feature | Description |
|---------|-------------|
| Enrollment optimization | "Group 10-2 has 5 empty seats. Group 10-3 is full. Consider moving students." |
| Revenue tracking | "You earned EGP 15,000 this month from 45 students. Average: EGP 333/student." |
| Teacher performance | "Teacher A's students average 78%. Teacher B's students average 85%." |
| Schedule conflicts | "Two groups are scheduled at the same time on Sunday. Fix?" |
| Churn prediction | "3 students haven't enrolled for next term. Follow up?" |

### How It Works

```
Weekly cron (Monday 8:00 AM):
  1. Gather metrics: enrollment counts, attendance rates, grade averages
  2. Run analysis queries against Supabase
  3. Generate insights using Gemini:
     "Based on this week's data:
      - 3 groups are under 50% capacity
      - Average attendance dropped 5% from last week
      - 2 students are at risk of dropping out"
  4. Send to center owner via WhatsApp/email
  5. Show in center dashboard
```

---

## 10. Teacher & Assistant AI Workflows

### Teacher's Biggest Time-Wasters
1. **Attendance marking** — 30+ min after class with 50+ students
2. **Writing report comments** — hours for 30+ students
3. **Answering parent queries** — 5 min per WhatsApp message
4. **Analyzing class performance** — manual spreadsheet work

### What Gets Delegated to Assistants
- Mark attendance during class (real-time sync with teacher)
- Enter grades from paper exams
- Respond to routine parent queries (attendance check, schedule)
- Manage student records (enrollment, group assignments)
- Prepare and distribute report cards

### AI Feature Matrix (by role)

| Feature | Teacher | Assistant | Parent |
|---------|---------|-----------|--------|
| Mark attendance | ✅ (one-tap) | ✅ (primary) | — |
| Enter grades | ✅ | ✅ | — |
| View reports | ✅ | ✅ (if permitted) | ✅ (WhatsApp) |
| Respond to parents | ✅ | ✅ (if permitted) | — |
| Receive AI alerts | ✅ | ❌ | ✅ (own child) |
| Configure automation | ✅ | ❌ | — |
| Approve AI drafts | ✅ | ✅ (if permitted) | — |

---

## 11. Attendance Intelligence

### AI-Assisted Attendance (Future)
- AI suggests attendance based on historical patterns: "Ahmed is usually present on Sundays. Mark as present?"
- Teacher/assistant confirms with one tap
- Reduces marking time from 30 min to 5 min

### Real-Time Sync (Teacher ↔ Assistant)
- Assistant marks attendance via mobile
- Teacher sees live updates on their dashboard
- "Ahmed marked present by Ahmed (assistant) at 10:32 AM"
- Both see the same data instantly

### Session Anomaly Detection
- AI compares current session to historical data
- "Usually 28 students present, today only 22. 6 students absent — unusual."
- Flags for teacher review

---

## 12. Grade Intelligence

### What AI Does With Grades

#### Question-Level Analysis
- After grades are entered, AI analyzes which questions students got wrong
- "Question 5 (factoring) was missed by 70% of the class. Consider re-teaching this topic."
- **Requires:** Teacher adds question-level notes per assessment (e.g., "Q5: factoring, Q3: linear equations")

#### Cross-Group Comparison
- AI compares grades across groups within the same offering
- "Section 1 average: 78%. Section 2 average: 65%. Section 2 may need extra support."
- Helps teachers identify groups that need different pacing

#### What AI CAN'T Do
- AI does NOT see exam papers, question content, or student answers
- AI sees: grades, attendance, assessment names/types, class averages, trends
- For question-level analysis, teacher must provide context notes per assessment

### Grade Analysis Pipeline

```
Teacher/assistant enters grades
    ↓
AI analyzes:
  1. Class average, median, standard deviation
  2. Comparison to previous assessments (trend)
  3. Cross-group comparison (if multiple groups)
  4. At-risk students (below threshold)
  5. Question-level patterns (if teacher provided notes)
    ↓
AI generates insights:
  "Class average improved 5% from last quiz.
   Section 2 is 13% below Section 1.
   3 students are trending downward."
    ↓
Teacher sees insights on dashboard
```

---

## 13. Report Comment Generation

### What AI Sees
- Grades per assessment
- Attendance records
- Assessment names and types
- Class averages and trends
- Teacher notes (if provided)

### What AI Does NOT See
- Exam papers or question content
- Student answers
- What was taught in class
- Student behavior or participation

### Comment Quality Tiers

#### Basic: Data Summary Only
```
"Ahmed scored 78% on midterm. Attendance: 90%. Class average: 72%."
```

#### Pro: Data + Trend Analysis
```
"Ahmed scored 78%, above class average. His attendance (90%)
supports consistent performance. Trend: improving from 72%
on Quiz 1. Strong in algebra, needs support in geometry."
```

#### Center: Teacher Notes + AI Analysis
```
Teacher provides notes: "Ahmed struggles with word problems."
AI generates: "Ahmed shows strength in algebra but needs
support with word problems. Recommend extra practice on
application questions. His consistent attendance (90%)
is a positive factor."
```

### Report Card Generation Flow

```
1. AI generates report card:
   - Grades table
   - Attendance %
   - Class rank
   - AI-written comment (based on tier)
    ↓
2. Assistant/teacher reviews and approves
   - Can edit the AI comment
   - Can add manual notes
    ↓
3. Report card is finalized
   - Sent to parent via WhatsApp (if configured)
   - Available for download (PDF)
```

---

## 14. Parent Communication AI

### Response Modes (Tiered)

#### Basic: Auto-Response (Pattern Matching)
- Parent asks: "What was Ahmed's attendance?"
- Bot queries DB, returns formatted answer
- No AI involved — direct data lookup

#### Pro: AI with DB Tools
- Parent asks: "How is Ahmed doing?"
- AI calls getStudentAttendance + getStudentGrades
- AI generates natural language response
- **Sends to teacher for approval before sending**
- Teacher approves with one tap

#### Center: Full Auto + Escalation
- AI handles routine queries automatically
- AI detects complex issues (bullying, special needs) → routes to teacher
- "This needs human attention" flag

### AI Draft → Teacher Approval Flow

```
Parent: "How is Ahmed doing?"
    ↓
AI generates draft:
  "Ahmed's attendance this month is 85%.
   His last quiz score was 78/100. He's
   performing well in algebra but needs
   more practice in geometry."
    ↓
Draft sent to teacher dashboard:
  "Parent of Ahmed asked about their child.
   Suggested response: [draft]
   [Approve] [Edit] [Handle myself]"
    ↓
Teacher approves → message sent to parent
```

### Sentiment Detection (Pro)
- AI detects frustration in parent messages
- Flags conversation: "Parent seems frustrated"
- Notifies teacher for human follow-up

---

## 15. Weekly AI Digest

### Content: Highlights + Action Items

```
Weekly Digest — Sunday 8:00 AM

HIGHLIGHTS:
• Class average improved 5% on last quiz
• Ahmed showed significant improvement (+15%)
• 2 groups performed above target

ACTION NEEDED:
• Follow up with 3 at-risk students:
  - Ahmed: attendance dropped to 68%
  - Fatima: grades declining over 3 weeks
  - Omar: missed 3 consecutive sessions
• 5 unread parent messages
• Midterm exams next week — review sessions recommended

UPCOMING:
• Math Grade 10 midterm: Jan 20
• Math Grade 11 quiz: Jan 25
```

### Delivery
- WhatsApp message to teacher (Pro+)
- In-app notification (all tiers)
- Email digest (Pro+, if configured)

### Frequency
- **Weekly only** (Sundays at 8:00 AM)
- Not daily — reduces noise, teacher can act on patterns
- Not real-time — weekly gives enough context for meaningful insights

---

## 16. Automation Triggers

### Auto-Reminders Before Exams
- 3 days before assessment
- Message: "Midterm exam next week for Math Grade 10. Topics: Chapters 1-5. Good luck!"
- Sent to all parents in the group

### Auto-Attendance Warnings
- When student attendance drops below 70%
- Message: "Ahmed has missed 4 sessions this month. Please ensure regular attendance."
- Sent to parent via WhatsApp

### Auto-Report Generation
- After grades are entered for an assessment
- AI generates report cards
- Assistant/teacher reviews and approves
- Auto-sends to parents

### Auto-Class Summary (Future)
- After each session, AI sends parents a summary
- "Today's topic: Quadratic Equations. Homework: Page 45, Q1-10."
- **Requires:** Teacher/assistant adds session notes

---

## 17. AI Cost Control

### Daily Token Budget Per Teacher

| Tier | Daily Tokens | Monthly Tokens | Est. Cost |
|------|-------------|----------------|-----------|
| Free | 0 | 0 | $0 |
| Basic | 5,000 | 150,000 | ~$0.19 |
| Pro | 20,000 | 600,000 | ~$0.75 |
| Center | 50,000 | 1,500,000 | ~$1.88 |

### Budget Behavior
- Tokens reset at midnight (Africa/Cairo timezone)
- When budget exceeded → AI pauses until next day
- Teacher sees: "AI daily limit reached. Resets at midnight."
- Emergency override: teacher can manually trigger AI (uses next day's budget)

### Cost Optimization
- Cache frequent queries for 5 minutes
- Use Gemini Flash for simple lookups, Pro for analysis
- Batch trend analysis weekly, not daily
- Per-teacher daily token limits in settings

---

## 18. Implementation Priority (Updated)

### Phase 1: Core (Weeks 1-4)
- [ ] Enhanced WhatsApp bot with DB tools (Gemini function calling)
- [ ] Real-time attendance sync (teacher ↔ assistant)
- [ ] Basic threshold alerts (attendance + grade)
- [ ] Template-based parent notifications

### Phase 2: Intelligence (Weeks 5-8)
- [ ] Grade analysis (cross-group comparison, at-risk detection)
- [ ] Report comment generation (tiered quality)
- [ ] AI-personalized parent messages
- [ ] Sentiment detection in WhatsApp conversations
- [ ] In-app notification system

### Phase 3: Agentic (Weeks 9-12)
- [ ] Weekly AI digest (highlights + action items)
- [ ] Auto-reminders before exams
- [ ] Auto-attendance warnings
- [ ] Report card generation with AI comments (assistant approves)

### Phase 4: Advanced (Weeks 13-16)
- [ ] AI-assisted attendance (one-tap suggestions)
- [ ] Question-level grade analysis
- [ ] Class summary auto-send to parents
- [ ] Center business intelligence

---

## 7. Gemini API Cost Estimate

| Feature | Requests/Day (per teacher) | Tokens/Request | Daily Cost |
|---------|---------------------------|----------------|------------|
| WhatsApp bot (Basic) | 20 | 500 | $0.0125 |
| WhatsApp bot (Pro, with tools) | 30 | 1,000 | $0.0375 |
| Report generation | 2 | 2,000 | $0.005 |
| AI parent messages | 10 | 800 | $0.01 |
| Trend analysis | 1 (weekly) | 3,000 | $0.00375 |
| **Total per teacher/day** | | | **~$0.07** |
| **Total per teacher/month** | | | **~$2.10** |

**At 500 Pro users:** $1,050/mo in Gemini costs. Covered by ~$2,500 MRR.

### Cost Optimization
- Cache frequent queries (student attendance/grades) for 5 minutes
- Use Gemini Flash (cheaper) for simple pattern matching, Pro for complex analysis
- Batch trend analysis (once per week, not daily)
- Set per-teacher daily token limits in settings

---

## 8. Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                    WhatsApp Parent                    │
│              (sends message via Baileys)              │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              messageParser.js                        │
│   Pattern matching → direct DB query → response     │
│   (attendance, grades, schedule)                     │
└──────────────────────┬──────────────────────────────┘
                       │ no match
                       ▼
┌─────────────────────────────────────────────────────┐
│              aiResponder.js                          │
│   Gemini with function calling:                      │
│   - getStudentAttendance()                          │
│   - getStudentGrades()                              │
│   - getClassPerformance()                           │
│   - generateReport()                                │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              whatsappQuery.js                        │
│   Supabase queries (via enrollment chain)           │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              Supabase PostgreSQL                     │
│   students, enrollments, grades, attendance, etc.   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              Cron Jobs (node-cron)                   │
│   - Daily: threshold alerts                          │
│   - Weekly: trend analysis, center insights         │
│   - Monthly: report generation, email digests       │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│              Notification Queue                      │
│   - In-app notifications                            │
│   - WhatsApp messages (Baileys)                     │
│   - Email (Resend)                                  │
└─────────────────────────────────────────────────────┘
```

---

## 9. Key Decisions (for ADR)

1. **Gemini over OpenAI:** Gemini has better Arabic language support, which is critical for Egypt/MENA. Also cheaper at scale.

2. **Function calling over RAG:** For WhatsApp bot, use Gemini's function calling (tools) to query the DB directly. No need for a vector database — the data is structured, not unstructured.

3. **Template + AI hybrid:** Basic tier uses templates (cheap, fast). Pro tier uses AI personalization (expensive, better UX). This keeps costs manageable.

4. **Cron over streaming:** Alerts and reports run on cron schedules, not real-time streams. Simpler, more predictable costs, easier to debug.

5. **Per-teacher token limits:** Each teacher gets a daily Gemini token budget based on their tier. Prevents abuse and controls costs.

6. **In-app + WhatsApp delivery:** In-app is free (just DB writes). WhatsApp costs Baileys bandwidth but no per-message fee. Email is last resort (costs money via Resend).
