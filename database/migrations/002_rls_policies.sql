-- Nabeeh RLS Policies
-- All tables are scoped to teacher ownership

-- ============================================================
-- Enable RLS on all tables
-- ============================================================
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TEACHERS: can only read/update own profile
-- ============================================================
CREATE POLICY "Teachers can view own profile"
  ON teachers FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Teachers can update own profile"
  ON teachers FOR UPDATE
  USING (id = auth.uid());

-- ============================================================
-- STUDENTS: scoped via teacher_id
-- ============================================================
CREATE POLICY "Teachers can view own students"
  ON students FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own students"
  ON students FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own students"
  ON students FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own students"
  ON students FOR DELETE
  USING (teacher_id = auth.uid());

-- ============================================================
-- PARENTS: via student → teacher chain
-- ============================================================
CREATE POLICY "Teachers can view parents of own students"
  ON parents FOR SELECT
  USING (
    student_id IN (
      SELECT id FROM students WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can insert parents for own students"
  ON parents FOR INSERT
  WITH CHECK (
    student_id IN (
      SELECT id FROM students WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update parents of own students"
  ON parents FOR UPDATE
  USING (
    student_id IN (
      SELECT id FROM students WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete parents of own students"
  ON parents FOR DELETE
  USING (
    student_id IN (
      SELECT id FROM students WHERE teacher_id = auth.uid()
    )
  );

-- ============================================================
-- SUBJECTS: public read, admin-managed
-- ============================================================
CREATE POLICY "Anyone can view subjects"
  ON subjects FOR SELECT
  USING (true);

-- ============================================================
-- TEACHER SUBJECTS: scoped to teacher
-- ============================================================
CREATE POLICY "Teachers can view own teacher_subjects"
  ON teacher_subjects FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can manage own teacher_subjects"
  ON teacher_subjects FOR ALL
  USING (teacher_id = auth.uid());

-- ============================================================
-- OFFERINGS: scoped to teacher
-- ============================================================
CREATE POLICY "Teachers can view own offerings"
  ON offerings FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own offerings"
  ON offerings FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own offerings"
  ON offerings FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own offerings"
  ON offerings FOR DELETE
  USING (teacher_id = auth.uid());

-- ============================================================
-- GROUPS: via offering → teacher chain
-- ============================================================
CREATE POLICY "Teachers can view groups in own offerings"
  ON groups FOR SELECT
  USING (
    offering_id IN (
      SELECT id FROM offerings WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can insert groups in own offerings"
  ON groups FOR INSERT
  WITH CHECK (
    offering_id IN (
      SELECT id FROM offerings WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update groups in own offerings"
  ON groups FOR UPDATE
  USING (
    offering_id IN (
      SELECT id FROM offerings WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete groups in own offerings"
  ON groups FOR DELETE
  USING (
    offering_id IN (
      SELECT id FROM offerings WHERE teacher_id = auth.uid()
    )
  );

-- ============================================================
-- ENROLLMENTS: via group → offering → teacher chain
-- ============================================================
CREATE POLICY "Teachers can view enrollments in own groups"
  ON enrollments FOR SELECT
  USING (
    group_id IN (
      SELECT g.id FROM groups g
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can insert enrollments in own groups"
  ON enrollments FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT g.id FROM groups g
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update enrollments in own groups"
  ON enrollments FOR UPDATE
  USING (
    group_id IN (
      SELECT g.id FROM groups g
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete enrollments in own groups"
  ON enrollments FOR DELETE
  USING (
    group_id IN (
      SELECT g.id FROM groups g
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = auth.uid()
    )
  );

-- ============================================================
-- GRADE LEVELS: public read
-- ============================================================
CREATE POLICY "Anyone can view grade_levels"
  ON grade_levels FOR SELECT
  USING (true);

-- ============================================================
-- SESSIONS: via group → offering → teacher chain
-- ============================================================
CREATE POLICY "Teachers can view sessions in own groups"
  ON sessions FOR SELECT
  USING (
    group_id IN (
      SELECT g.id FROM groups g
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can insert sessions in own groups"
  ON sessions FOR INSERT
  WITH CHECK (
    group_id IN (
      SELECT g.id FROM groups g
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = auth.uid()
    )
  );

-- ============================================================
-- ATTENDANCE: via session → group → offering → teacher
-- ============================================================
CREATE POLICY "Teachers can view attendance in own sessions"
  ON attendance FOR SELECT
  USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN groups g ON s.group_id = g.id
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can insert attendance in own sessions"
  ON attendance FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN groups g ON s.group_id = g.id
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update attendance in own sessions"
  ON attendance FOR UPDATE
  USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN groups g ON s.group_id = g.id
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = auth.uid()
    )
  );

-- ============================================================
-- ASSESSMENTS: via offering → teacher
-- ============================================================
CREATE POLICY "Teachers can view assessments in own offerings"
  ON assessments FOR SELECT
  USING (
    offering_id IN (
      SELECT id FROM offerings WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can insert assessments in own offerings"
  ON assessments FOR INSERT
  WITH CHECK (
    offering_id IN (
      SELECT id FROM offerings WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update assessments in own offerings"
  ON assessments FOR UPDATE
  USING (
    offering_id IN (
      SELECT id FROM offerings WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete assessments in own offerings"
  ON assessments FOR DELETE
  USING (
    offering_id IN (
      SELECT id FROM offerings WHERE teacher_id = auth.uid()
    )
  );

-- ============================================================
-- GRADES: via enrollment → group → offering → teacher
-- ============================================================
CREATE POLICY "Teachers can view grades in own offerings"
  ON grades FOR SELECT
  USING (
    enrollment_id IN (
      SELECT e.id FROM enrollments e
      JOIN groups g ON e.group_id = g.id
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can insert grades in own offerings"
  ON grades FOR INSERT
  WITH CHECK (
    enrollment_id IN (
      SELECT e.id FROM enrollments e
      JOIN groups g ON e.group_id = g.id
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update grades in own offerings"
  ON grades FOR UPDATE
  USING (
    enrollment_id IN (
      SELECT e.id FROM enrollments e
      JOIN groups g ON e.group_id = g.id
      JOIN offerings o ON g.offering_id = o.id
      WHERE o.teacher_id = auth.uid()
    )
  );

-- ============================================================
-- CONVERSATIONS: scoped to teacher
-- ============================================================
CREATE POLICY "Teachers can view own conversations"
  ON conversations FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own conversations"
  ON conversations FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own conversations"
  ON conversations FOR UPDATE
  USING (teacher_id = auth.uid());

-- ============================================================
-- MESSAGES: via conversation → teacher
-- ============================================================
CREATE POLICY "Teachers can view messages in own conversations"
  ON messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can insert messages in own conversations"
  ON messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM conversations WHERE teacher_id = auth.uid()
    )
  );

-- ============================================================
-- TEACHER SETTINGS: scoped to teacher
-- ============================================================
CREATE POLICY "Teachers can view own settings"
  ON teacher_settings FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own settings"
  ON teacher_settings FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own settings"
  ON teacher_settings FOR UPDATE
  USING (teacher_id = auth.uid());

-- ============================================================
-- PASSWORD RESET TOKENS: scoped to teacher
-- ============================================================
CREATE POLICY "Teachers can view own reset tokens"
  ON password_reset_tokens FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own reset tokens"
  ON password_reset_tokens FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

-- ============================================================
-- AUTH AUDIT LOG: scoped to teacher
-- ============================================================
CREATE POLICY "Teachers can view own audit log"
  ON auth_audit_log FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own audit log"
  ON auth_audit_log FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

-- ============================================================
-- FAQs: scoped to teacher
-- ============================================================
CREATE POLICY "Teachers can view own FAQs"
  ON faqs FOR SELECT
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can insert own FAQs"
  ON faqs FOR INSERT
  WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Teachers can update own FAQs"
  ON faqs FOR UPDATE
  USING (teacher_id = auth.uid());

CREATE POLICY "Teachers can delete own FAQs"
  ON faqs FOR DELETE
  USING (teacher_id = auth.uid());
