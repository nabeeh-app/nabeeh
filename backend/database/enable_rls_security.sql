-- Enable RLS and Add Policies for Security Hardening
-- Targets tables flagged in security review

-- 1. Reference Data (Read Specific, Write Admin Only)
ALTER TABLE grade_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read grade_levels" ON grade_levels FOR SELECT TO authenticated USING (true);
-- No write policy = Admin only (Service Role)

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read subjects" ON subjects FOR SELECT TO authenticated USING (true);

ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage own subjects" ON teacher_subjects FOR ALL TO authenticated USING (teacher_id = auth.uid());


-- 2. Communication Tables (WhatsApp/Messages)
-- Assuming tables exist from previous setup (as they were not in schema_v2 but are in use)

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can view own conversations" ON conversations FOR SELECT TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "Teachers can update own conversations" ON conversations FOR UPDATE TO authenticated USING (teacher_id = auth.uid());
-- Note: Insert might happen via webhook/system, usually service role. If teacher initiates, they need insert.
CREATE POLICY "Teachers can insert conversations" ON conversations FOR INSERT TO authenticated WITH CHECK (teacher_id = auth.uid());

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
-- Direct link to teacher not usually in messages, usually via conversation_id
-- Policy: specific teacher can read messages if they own the conversation
CREATE POLICY "Teachers can view messages in own conversations" ON messages FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM conversations 
        WHERE id = messages.conversation_id 
        AND teacher_id = auth.uid()
    )
);
CREATE POLICY "Teachers can insert messages" ON messages FOR INSERT TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM conversations 
        WHERE id = messages.conversation_id 
        AND teacher_id = auth.uid()
    )
);

ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage own scheduled messages" ON scheduled_messages FOR ALL TO authenticated USING (teacher_id = auth.uid());


-- 3. Teacher Settings & Assets
ALTER TABLE teacher_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage own settings" ON teacher_settings FOR ALL TO authenticated USING (teacher_id = auth.uid());

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage own faqs" ON faqs FOR ALL TO authenticated USING (teacher_id = auth.uid());

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage own documents" ON documents FOR ALL TO authenticated USING (teacher_id = auth.uid());


-- 4. Academic Data (New Schema Tables)

-- Teachers (Profile)
-- Already enabled in schema_v2, adding policy
CREATE POLICY "Teachers can read own profile" ON teachers FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Teachers can update own profile" ON teachers FOR UPDATE TO authenticated USING (id = auth.uid());

-- Offerings
CREATE POLICY "Teachers can manage own offerings" ON offerings FOR ALL TO authenticated USING (teacher_id = auth.uid());

-- Groups
-- Groups belong to offerings
CREATE POLICY "Teachers can manage groups in own offerings" ON groups FOR ALL TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM offerings 
        WHERE id = groups.offering_id 
        AND teacher_id = auth.uid()
    )
);

-- Enrollments
-- Link students to groups
CREATE POLICY "Teachers can view enrollments in own groups" ON enrollments FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM groups
        JOIN offerings ON groups.offering_id = offerings.id
        WHERE groups.id = enrollments.group_id
        AND offerings.teacher_id = auth.uid()
    )
);
CREATE POLICY "Teachers can manage enrollments in own groups" ON enrollments FOR ALL TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM groups
        JOIN offerings ON groups.offering_id = offerings.id
        WHERE groups.id = enrollments.group_id
        AND offerings.teacher_id = auth.uid()
    )
);

-- Students
-- Complex because students are shared or independent?
-- For now, allow teachers to view ANY student they have an enrollment for.
CREATE POLICY "Teachers can view enrolled students" ON students FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM enrollments 
        JOIN groups ON enrollments.group_id = groups.id
        JOIN offerings ON groups.offering_id = offerings.id
        WHERE enrollments.student_id = students.id
        AND offerings.teacher_id = auth.uid()
    )
);
-- Allow creating students? Yes.
CREATE POLICY "Teachers can create students" ON students FOR INSERT TO authenticated WITH CHECK (true);
-- Note: 'true' allows creating any student, but practically they will link it immediately. 
-- Validating they only update their own students is harder without a direct link col, 
-- but we can rely on application logic + the fact that they can't 'see' others primarily.


-- Assessments
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can manage assessments in own offerings" ON assessments FOR ALL TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM offerings 
        WHERE id = assessments.offering_id 
        AND teacher_id = auth.uid()
    )
);

-- Attendance (Already enabled in schema_v2, adding policy)
CREATE POLICY "Teachers can manage attendance for own enrollments" ON attendance FOR ALL TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM enrollments
        JOIN groups ON enrollments.group_id = groups.id
        JOIN offerings ON groups.offering_id = offerings.id
        WHERE enrollments.id = attendance.enrollment_id
        AND offerings.teacher_id = auth.uid()
    )
);

-- Grades (Already enabled in schema_v2, adding policy)
CREATE POLICY "Teachers can manage grades for own assessments" ON grades FOR ALL TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM assessments
        JOIN offerings ON assessments.offering_id = offerings.id
        WHERE assessments.id = grades.assessment_id
        AND offerings.teacher_id = auth.uid()
    )
);

-- Parents (Already enabled in schema_v2, adding policy)
CREATE POLICY "Teachers can view parents of enrolled students" ON parents FOR SELECT TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM students
        JOIN enrollments ON students.id = enrollments.student_id
        JOIN groups ON enrollments.group_id = groups.id
        JOIN offerings ON groups.offering_id = offerings.id
        WHERE parents.student_id = students.id
        AND offerings.teacher_id = auth.uid()
    )
);
