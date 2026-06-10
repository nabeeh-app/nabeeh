# Nabeeh

Smart teaching assistant for classroom management, student tracking, attendance, grade management, and parent communication via WhatsApp. Targets private tutors and tutoring centers in Egypt/MENA.

## Language

**Teacher**:
An account holder who uses Nabeeh to manage students, attendance, and grades. A teacher owns their students and offerings.
_Avoid_: instructor, tutor, educator

**Center**:
A tutoring center with multiple teachers. All teachers under one center share the same Supabase project but have independent student lists.
_Avoid_: school, organization

**Student**:
A learner enrolled in a teacher's offering. Students are owned by a single teacher — they are not global entities.
_Avoid_: pupil, learner, user

**Parent**:
A contact person linked to one or more students. Parents communicate with the teacher via WhatsApp and can query their child's attendance/grades through the bot.
_Avoid_: guardian, contact

**Offering**:
A course a teacher provides, defined by (teacher, subject, grade_level, academic_year). An offering contains one or more groups.
_Avoid_: course, class, program

**Group**:
A cohort of students within an offering. A group has a schedule (e.g., "Sun/Tue 10 AM") and a capacity limit.
_Avoid_: cohort, section, class

**Enrollment**:
The link between a student and a group. A student can be enrolled in multiple groups (e.g., Math Group A and Physics Group B).
_Avoid_: registration, signup

**Assessment**:
A graded event within an offering — midterm, quiz, homework, final exam. Each assessment has a max score and a date.
_Avoid_: test, exam (use "assessment" as the generic term)

**Grade**:
A student's score on a specific assessment. Stored as (enrollment, assessment, score).
_Avoid_: mark, result, score (use "grade" for the stored record)

**Session**:
A single class meeting where attendance is recorded. A session belongs to a group on a specific date.
_Avoid_: class, lecture, meeting

**Attendance**:
A student's presence status (present/absent/late/excused) for a specific session.
_Avoid_: check-in, roll call

**WhatsApp Bot**:
The automated system that responds to parent queries via WhatsApp. Uses pattern matching for structured queries (attendance, grades) and Gemini AI for free-form responses.
_Avoid_: chatbot, assistant (in code context, use "bot")

**Feature Flag**:
A boolean toggle that controls whether a UI feature is visible and accessible. Stored in `featureFlags.ts`.
_Avoid_: toggle, switch, feature gate

---

## Assistants & Permissions

**Assistant**:
A separate user linked to one or more teachers via the `teacher_assistants` junction table. Assistants have their own Supabase Auth login and operate under a teacher's account with scoped permissions. An assistant can work for multiple teachers simultaneously, with different permissions per teacher.
_Avoid_: helper, aide, helper teacher, sub-user

**Permission Flag**:
One of eight boolean toggles controlling what an assistant can do within a teacher's account: `view_students`, `manage_attendance`, `manage_grades`, `manage_assessments`, `manage_offerings`, `send_whatsapp`, `view_reports`, `manage_students`. Teachers define a default template and customize per assistant.
_Avoid_: role, access level, permission bit

**Attendance Lock**:
A DB-persisted record (`attendance_locks` table) preventing concurrent edits to the same student's attendance within a session. Locks are per-student-row and auto-release after 5 minutes of inactivity (configurable in teacher settings).
_Avoid_: session lock, row lock, edit lock

**Conversation Handoff**:
The mechanism where the WhatsApp bot pauses auto-responding when a human (teacher or assistant) sends a manual message to a parent. Bot resumes after a configurable timeout or when manually toggled back on. The parent always sees the teacher's identity — assistants operate under the teacher's name.
_Avoid_: bot pause, human takeover, bot disable

**Invite Token**:
A unique, time-limited (48h) token sent to an assistant's email when a teacher invites them. The assistant clicks the link, signs up or logs in, and is auto-linked to the teacher. Pending invites are gated by the teacher's subscription tier.
_Avoid_: invitation code, invite link (use "invite token" for the DB record)

---

## Authentication

**Google Login**:
OAuth sign-in via Supabase's built-in Google provider. Available to both teachers and assistants on both login and register pages. If a user already has an email/password account, signing in with Google on the same email auto-links the provider to the existing account. Email must match exactly for invite linking (strict mode).
_Avoid_: Google OAuth, social login, SSO (use "Google Login" for user-facing, "Google provider" for technical context)

**Onboarding Tour**:
A guided walkthrough shown to teachers on first login after Google sign-up. Confirms name, subjects, and timezone from Google profile, then provides an in-app product tour. Email/password signups skip the profile confirmation step but still get the tour.
_Avoid_: setup wizard, getting started flow
