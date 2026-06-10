# Onboarding, Setup Flow & Feature Gating — Nabeeh

## Design Principles

1. **Profile setup is the only mandatory step.** Teacher must complete name + subjects before using the platform.
2. **WhatsApp setup is semi-mandatory.** Persistent banner nudges until setup or 3x dismissed.
3. **Progressive unlock.** Features unlock as the teacher uses the platform — not all at once.
4. **Demo data on first login.** Teacher sees a working dashboard immediately, not an empty shell.
5. **Auto-cleanup.** Demo data disappears when teacher creates their first real data.

---

## Onboarding Flow

### Step 1: Auth (Google or Email)
- Teacher signs up via Google or email/password
- Google: auto-fills name from profile
- Email: standard registration form

### Step 2: Profile Setup (Mandatory)
After first login, teacher MUST complete:
- Full name (pre-filled if Google)
- Subjects taught (multi-select)
- Timezone (pre-filled from Google or default Africa/Cairo)

**Cannot skip.** Dashboard is locked until profile is complete.

### Step 3: Guided Tour (Optional but Shown)
After profile setup, a 4-step product tour runs:
1. "This is your dashboard — see your students and stats here"
2. "Create offerings and groups in Courses"
3. "Mark attendance in Attendance"
4. "Parents can check grades via WhatsApp — set it up in Settings"

Tour is dismissable at any step. Can be replayed from Settings > Help.

### Step 4: First Login → Demo Data
Teacher lands on a **fully populated dashboard** with demo data:
- 1 offering: "Math — Grade 10" (Academic Year 2025-2026)
- 3 groups: Section 1, Section 2, Section 3
- 15 students with Arabic/English names
- 5 past attendance sessions with realistic marks (80-95% attendance)
- 2 assessments (Quiz 1, Midterm) with grades
- 3 parent contacts
- 2 WhatsApp conversations (simulated)

**Purpose:** Teacher immediately sees what the platform looks like with real data. They can navigate all pages, click around, and understand the value.

---

## Demo Data Lifecycle

### On First Login
Demo data is created in a `demo_data` namespace (flagged in DB with `is_demo: true` on all records).

### Auto-Removal Trigger
When the teacher creates their first **real** offering OR adds their first **real** student:
1. System detects real data exists
2. Shows a one-time modal: "Ready to start for real? We'll clear the demo data."
3. Teacher confirms → all `is_demo: true` records are deleted
4. Dashboard refreshes with only real data

### If Teacher Never Creates Real Data
Demo data stays indefinitely. This is fine — the teacher is exploring, not committing.

---

## Setup Progress Indicator

### What's Tracked

| Step | Mandatory? | Unlocks |
|------|-----------|---------|
| Complete profile | ✅ Yes | Dashboard access |
| Create first offering | No | Courses page |
| Add first student | No | Students page |
| Mark first attendance | No | Attendance page |
| Set up WhatsApp | Semi-mandatory | WhatsApp bot |
| Add first assessment | No | Grades page |
| Invite an assistant | No | Assistants page |

### Progress Bar Behavior
- Appears at top of dashboard until all steps are done (or dismissed)
- Shows: "You're 40% set up! Next: Create your first offering"
- Dismiss button → hides for 7 days, then reappears
- After 3 dismisses → hides permanently
- Progress resets if teacher clears all data

### Progress Calculation
```
profile_complete: 15% (mandatory, counted first)
offering_created: 15%
student_added: 15%
attendance_marked: 15%
whatsapp_configured: 20%
assessment_created: 10%
assistant_invited: 10%
```

---

## Feature Visibility (Progressive Unlock)

### Tier 1: Always Visible (Day 1)
- Dashboard (with demo data)
- Profile / Settings
- Courses (offering management)

### Tier 2: Visible After First Offering Created
- Students (can't enroll without an offering)
- Groups (part of offering setup)

### Tier 3: Visible After First Student Added
- Attendance (need students to mark attendance)
- Grades (need students to have grades)

### Tier 4: Visible After First Attendance Marked
- Reports (need data to generate reports)
- Messages (WhatsApp conversations)

### Tier 5: Visible After WhatsApp Configured
- WhatsApp bot status
- Parent notifications
- Alerts

### Implementation
```typescript
// Feature gates based on setup progress
const featureGates = {
  students: teacher.offerings.length > 0,
  attendance: teacher.students.length > 0,
  grades: teacher.students.length > 0,
  reports: teacher.attendanceRecords.length > 0,
  whatsapp: teacher.whatsappConfigured,
  messages: teacher.whatsappConfigured,
  assistants: teacher.students.length > 5, // need enough students to warrant an assistant
  alerts: teacher.attendanceRecords.length > 10, // need history for alerts to be useful
};
```

### Sidebar Behavior
- Features that are locked show in the sidebar but are **dimmed** with a lock icon
- Hovering shows: "Create an offering to unlock Students"
- Clicking a locked feature shows the setup prompt, not the page
- Once unlocked, the dimming and lock icon disappear

---

## WhatsApp Semi-Mandatory Nudge

### Banner Behavior
- Shows at top of dashboard after profile setup is complete
- Text: "Connect WhatsApp so parents can check grades automatically"
- Buttons: [Set up now] [Dismiss]
- Dismiss hides banner for current session
- After 3 dismisses → banner hides permanently
- Banner reappears if teacher navigates to Settings > WhatsApp

### Why Semi-Mandatory
- WhatsApp is Nabeeh's key differentiator
- Without it, the bot doesn't work, parents can't self-serve
- But it requires Baileys setup (QR scan) which takes 2 minutes
- Teacher should understand the value before setting it up

---

## Empty States (Post-Demo Cleanup)

When demo data is removed and teacher hasn't added real data yet:

### Dashboard Empty State
```
┌─────────────────────────────────────────┐
│                                         │
│     📊 Your dashboard is empty         │
│                                         │
│     Create your first offering to      │
│     see students, attendance, and      │
│     grades here.                        │
│                                         │
│     [Create Offering]                   │
│                                         │
└─────────────────────────────────────────┘
```

### Students Empty State
```
┌─────────────────────────────────────────┐
│                                         │
│     👥 No students yet                 │
│                                         │
│     Add students to start tracking     │
│     attendance and grades.              │
│                                         │
│     [Add Student]  [Import from CSV]   │
│                                         │
└─────────────────────────────────────────┘
```

### Attendance Empty State
```
┌─────────────────────────────────────────┐
│                                         │
│     📋 No attendance records           │
│                                         │
│     Create a session and mark          │
│     attendance for your students.      │
│                                         │
│     [Create Session]                    │
│                                         │
└─────────────────────────────────────────┘
```

---

## Contextual Tips

After demo data is removed, show contextual tips when teacher navigates to new pages for the first time:

| Page | Tip |
|------|-----|
| Students | "Add students manually or import from a CSV file" |
| Attendance | "Tap a student's name to mark present/absent/late" |
| Grades | "Create an assessment first, then enter grades for each student" |
| Courses | "An offering = subject + grade level. Groups are sections within it." |
| WhatsApp | "Scan the QR code with your phone to connect WhatsApp" |
| Reports | "Generate reports after you have at least 2 weeks of attendance data" |

Tips appear as a small toast notification, auto-dismiss after 5 seconds. Can be replayed from Settings > Help.

---

## Implementation Checklist

- [ ] Add `is_demo` boolean column to all data tables (or use a separate demo_data table)
- [ ] Create seed script for demo data (offering, groups, students, attendance, grades, parents)
- [ ] Build profile setup wizard (mandatory step after first login)
- [ ] Build guided tour component (4-step overlay)
- [ ] Build progress bar component (top of dashboard, dismissable)
- [ ] Implement feature gates in sidebar (dim + lock icon for locked features)
- [ ] Build empty state components for each page
- [ ] Build WhatsApp setup banner (persistent, dismissable, 3x limit)
- [ ] Implement demo data auto-removal on first real data creation
- [ ] Build contextual tip toasts (auto-dismiss, replayable)
- [ ] Add Settings > Help page (replay tour, replay tips)
