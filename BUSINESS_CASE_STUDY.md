# Nabeeh — Business Case Study

## Executive Summary

Nabeeh is a bilingual (Arabic/English) smart teaching assistant platform designed for private tutors and tutoring centers in Egypt and the MENA region. It replaces spreadsheet-based classroom management and scattered WhatsApp conversations with a unified system that tracks students, attendance, grades, and automates parent communication through an intelligent WhatsApp bot.

**Target Users:** Private tutors, tutoring centers, teaching assistants, and parents of students.

---

## Problem Statement

Private tutors and small tutoring centers in the MENA region face several challenges:

- **Fragmented tools:** Student data lives in Excel sheets, attendance is tracked on paper, grades are scattered across notebooks, and parent communication happens through unstructured WhatsApp chats.
- **No centralized student record:** When a teacher manages multiple groups and subjects, tracking a single student's full academic picture becomes nearly impossible.
- **Parent communication overhead:** Parents constantly ask the same questions — "Is my child present today?" "What were the last grades?" — consuming hours of the teacher's time daily.
- **Language barrier:** Most existing EdTech platforms are English-only, while the MENA market needs full Arabic support with RTL (right-to-left) interface.
- **Scalability:** As a tutor grows from 10 to 50+ students, manual processes break down.

---

## Solution

Nabeeh provides an all-in-one platform that handles the complete lifecycle of private tutoring operations:

1. **Student & Group Management** — Organize students into courses and groups with schedules and capacity limits.
2. **Attendance Tracking** — Quick daily attendance marking with calendar views and statistics.
3. **Grade Management** — Enter, analyze, and track grades across assessments with AI-powered insights.
4. **Automated Parent Communication** — A bilingual WhatsApp bot that answers parent queries 24/7 without teacher intervention.
5. **Team Collaboration** — Invite assistants with granular permissions to help manage classes.

---

## Core Features & Capabilities

### 1. Student Management

| Feature | Description |
|---------|-------------|
| Student Registration | Add students with name, code, phone, and enroll them in groups |
| Bulk Import | Upload students from Excel, CSV, or TSV files with auto-detected column mapping |
| Self-Registration Links | Generate shareable links for students to self-enroll in specific groups (with expiry and use limits) |
| Student Profiles | Full student view with enrollment history, attendance, grades, and parent contacts |
| Student Statistics | Per-student attendance rate and academic average at a glance |
| Search & Filter | Find students quickly by name, code, or enrollment status |

**Business Value:** Eliminates manual data entry, reduces onboarding time for new students, and provides instant visibility into any student's complete record.

---

### 2. Course & Group Management

| Feature | Description |
|---------|-------------|
| Course Offerings | Define courses by subject, grade level, and academic year |
| Group Creation | Create class groups within offerings with names, schedules, and max capacity |
| Enrollment Management | Enroll/unenroll students with capacity enforcement and re-enrollment support |
| Classes Overview | Simplified view of all groups with schedules, subjects, and status |

**Business Value:** Enables tutors to organize their offerings professionally, manage capacity constraints, and maintain clear schedules.

---

### 3. Attendance Tracking

| Feature | Description |
|---------|-------------|
| Daily Attendance | Mark students as Present, Absent, Late, or Excused for any session |
| Bulk Marking | Mark all students present or absent with one click, then adjust individually |
| Calendar View | Visual calendar overview of attendance patterns |
| Attendance History | Filterable records by date range, student, or group |
| Attendance Statistics | Aggregated stats: total sessions, attendance rate, breakdown by status |
| Concurrent Edit Protection | Database-level locking prevents two people from editing the same record simultaneously |

**Business Value:** Saves 10-15 minutes per class session. Provides data-driven insights into attendance patterns. Eliminates paper-based tracking.

---

### 4. Grade Management

| Feature | Description |
|---------|-------------|
| Individual Grade Entry | Enter grades for students on specific assessments (quiz, midterm, final, homework) |
| Bulk Grade Entry | Enter grades for multiple students in a single action |
| Grade Filtering | View grades by student, subject, assessment type, or date range |
| Grade Statistics | Average scores, breakdowns by subject and assessment type |
| Assessment Management | Create and manage assessments with names, types, max scores, and dates |

**Business Value:** Centralizes all grade data, eliminates paper gradebooks, and provides instant analytics on student performance.

---

### 5. Advanced Grade Analytics

| Feature | Description |
|---------|-------------|
| Group Comparison | Compare average scores across groups within a course offering |
| At-Risk Student Detection | Automatically identifies students falling below grade or attendance thresholds |
| Grade Distribution | Histogram visualization of score distributions for any assessment |
| Student Grade Trends | Track individual student progression over time |
| Offering Overview | Aggregate statistics: average, median, pass rate, highest and lowest scores |

**Business Value:** Enables data-driven teaching decisions, early intervention for struggling students, and professional reporting to parents.

---

### 6. Parent Management

| Feature | Description |
|---------|-------------|
| Parent Contacts | Store parent name, phone, email, relationship type, and preferred language |
| Linked Students | View which students each parent is connected to |
| Primary Contact | Flag primary contact for multi-parent households |

**Business Value:** Maintains a structured parent database for efficient communication and record-keeping.

---

### 7. WhatsApp Integration & Bot

| Feature | Description |
|---------|-------------|
| QR Code Connection | Connect WhatsApp by scanning a QR code (similar to WhatsApp Web) |
| Direct Messaging | Send WhatsApp messages to any phone number from the dashboard |
| **Attendance Bot** | Parents ask about attendance — bot responds instantly with present/absent status |
| **Grade Bot** | Parents ask about grades — bot responds with recent scores, averages, and letter grades |
| **Help Command** | Bot explains its capabilities when parents type "help" |
| **AI Fallback** | Unrecognized queries are handled by Gemini AI in the teacher's persona |
| **FAQ System** | Teacher can create custom FAQ entries for common parent questions |
| **Conversation Handoff** | When teacher manually messages a parent, bot pauses for 4 hours |
| **Marketing Messages** | Unregistered numbers receive an automated introduction to Nabeeh's features |
| **Message Statistics** | Track total messages, automated vs manual, and most common parent intents |

**Business Value:** The flagship differentiator. Saves teachers hours daily by automating repetitive parent queries. Available 24/7. Supports both Arabic and English. The marketing feature turns parent inquiries into lead generation.

---

### 8. Assistant (Team) Management

| Feature | Description |
|---------|-------------|
| Invite Assistants | Send email invitations with unique tokens (valid 48 hours) |
| Granular Permissions | 8 permission flags: view/manage students, attendance, grades, assessments, offerings, WhatsApp, reports |
| Activate/Deactivate | Toggle assistant access without removing them entirely |
| Remove Assistant | Soft-delete an assistant relationship |
| Assistant Self-Service | Assistants can voluntarily leave a teacher's team |

**Business Value:** Enables tutoring centers to scale by delegating tasks to assistants while maintaining control over what each assistant can access.

---

### 9. Reports & AI-Powered Insights

| Feature | Description |
|---------|-------------|
| AI Report Comments | Gemini AI generates personalized student progress reports from grades and attendance data |
| Bulk Report Generation | Generate report comments for all students in a group at once |
| Report Draft Management | Review, edit, approve, or reject AI-generated reports before sending |
| Weekly Digest | Automated weekly summary of teaching activity and trends |

**Business Value:** Reduces report-writing time from hours to minutes. Provides professional, personalized reports that enhance parent satisfaction.

---

### 10. Alerts & Notifications

| Feature | Description |
|---------|-------------|
| Alert Rules | Configurable triggers for attendance thresholds, grade thresholds, or trend anomalies |
| Notification Center | In-app feed for events like report sent, attendance marked, assistant actions |
| Notification Preferences | Choose which events to receive and set quiet hours |
| Alert Severity | Warning and critical severity levels with filtering |

**Business Value:** Proactive monitoring ensures no student falls through the cracks. Teachers are alerted to issues before they become problems.

---

### 11. System Monitoring

| Feature | Description |
|---------|-------------|
| Health Dashboard | System status, API uptime, WhatsApp connection status, database health |
| Performance Metrics | Response time, active connections, request counts, error rates |

**Business Value:** Ensures reliability and provides transparency into system health.

---

### 12. Onboarding & User Experience

| Feature | Description |
|---------|-------------|
| Guided Onboarding Tour | 4-step walkthrough for new teachers: profile, subjects, WhatsApp, completion |
| Demo Data | Auto-loaded sample students, attendance, grades, and courses for exploration |
| Setup Progress Tracker | Tracks completion milestones with percentage display |
| Progressive Feature Locking | Features unlock as prerequisites are met (students before attendance, etc.) |

**Business Value:** Reduces time-to-value for new users. Teachers can explore the platform with demo data before committing their real data.

---

### 13. Bilingual Support (Arabic/English)

| Feature | Description |
|---------|-------------|
| Full UI Translation | Complete Arabic and English translations for all interface elements |
| RTL Support | Right-to-left layout for Arabic users |
| Language Switcher | Instant language toggle in the sidebar |
| Bilingual WhatsApp Bot | Bot detects parent language and responds accordingly |
| Localized Marketing | Arabic marketing messages for Egyptian numbers, English for others |

**Business Value:** Serves the entire MENA market. No competitor offers full bilingual support with RTL in this niche.

---

### 14. Security & Data Privacy

| Feature | Description |
|---------|-------------|
| Role-Based Access Control | Teacher vs Assistant vs Admin permission system |
| Data Isolation | Teachers only see data for students in their groups — complete separation |
| Rate Limiting | Multi-tier protection: login (20/5min), register (20/hr), reset (3/hr) |
| Input Validation | All user input validated before processing |
| Audit Logging | Every significant action logged with actor, action, entity, and IP address |
| Session Security | JWT tokens in httpOnly cookies, CSRF protection |

**Business Value:** Enterprise-grade security ensures student data privacy and regulatory compliance.

---

### 15. Landing Page & Marketing

| Feature | Description |
|---------|-------------|
| Public Landing Page | Hero, features, screenshot gallery, pricing, FAQ, and call-to-action |
| Interactive Bot Demo | Visitors can simulate parent queries with sample students |
| Pricing Tiers | Free (20 students), Pro (unlimited), Center (multi-teacher) |

**Business Value:** Self-service marketing funnel that educates prospects and drives sign-ups.

---

## User Roles & Permissions

| Role | Access Level |
|------|-------------|
| **Teacher** | Full access to all features for their own data |
| **Assistant** | Granular permissions set by the teacher (view students, manage attendance, etc.) |
| **Admin** | System-wide access, user management, audit logs |

---

## Subscription Tiers

| Tier | Price | Students | Groups | Assistants | Features |
|------|-------|----------|--------|------------|----------|
| **Free** | $0 | Up to 20 | 1 | 0 | Core attendance, grades, WhatsApp bot |
| **Basic** | Coming Soon | — | — | 2 | Enhanced limits |
| **Pro** | Coming Soon | Unlimited | Unlimited | 5 | Advanced analytics, bulk reports |
| **Center** | Coming Soon | Unlimited | Unlimited | 15 | Multi-teacher, branding, custom bot |

---

## Key Differentiators

1. **Bilingual-first:** Full Arabic/English support with RTL — not an afterthought.
2. **WhatsApp Bot:** The only classroom management tool with an intelligent, bilingual WhatsApp bot that handles parent queries automatically.
3. **AI-Powered Reports:** Gemini AI generates personalized student progress reports.
4. **At-Risk Detection:** Automatic identification of students falling behind.
5. **Per-Teacher Data Isolation:** Complete data separation between teachers — a privacy-first architecture.
6. **MENA-Focused:** Designed specifically for the Egyptian/MENA private tutoring market.

---

## Market Opportunity

- **Egypt alone** has millions of private tutoring students, with parents spending significant portions of household income on education.
- **WhatsApp is the dominant communication channel** in the MENA region — integrating directly with it eliminates friction.
- **No direct competitor** offers bilingual classroom management + WhatsApp bot + AI reports in one platform.
- **Scalable from solo tutors to tutoring centers** with the tiered subscription model.

---

## Impact Metrics (Projected)

| Metric | Before Nabeeh | After Nabeeh |
|--------|---------------|--------------|
| Time spent on parent queries | 1-2 hours/day | < 5 minutes/day |
| Attendance tracking | 10-15 min/class | 2-3 min/class |
| Report generation | 30-60 min/student | 1-2 min/student (AI draft) |
| Data lookup time | Minutes (spreadsheets) | Seconds (instant search) |
| Parent communication | Manual, one-by-one | Automated 24/7 via WhatsApp |

---

*Document generated from Nabeeh codebase analysis. Last updated: June 2026.*
