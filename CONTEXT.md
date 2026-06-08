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
