-- Normalized Database Schema for Nabeeh
-- Version: 2.1 (With Drop & Parents)

-- Drop existing tables to ensure clean slate
DROP TABLE IF EXISTS grades CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS offerings CASCADE;
DROP TABLE IF EXISTS teacher_subjects CASCADE;
DROP TABLE IF EXISTS parents CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS grade_levels CASCADE;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Reference Tables (Static Data)
CREATE TABLE IF NOT EXISTS grade_levels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE, -- e.g., "1st Secondary", "Grade 10"
    "order" INTEGER NOT NULL -- For sorting (e.g., 10, 11, 12)
);

CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) NOT NULL UNIQUE, -- e.g., "PHYS", "MATH"
    name_en VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100) NOT NULL
);

-- 2. Users & Teachers
-- Note: 'teachers' table extends Supabase Auth system
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    business_name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_code VARCHAR(50) NOT NULL UNIQUE, -- External ID/Reference
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Teacher Specialization
CREATE TABLE IF NOT EXISTS teacher_subjects (
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    PRIMARY KEY (teacher_id, subject_id)
);

-- 4. The "Offering" (Teacher + Subject + Grade)
CREATE TABLE IF NOT EXISTS offerings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    grade_level_id UUID REFERENCES grade_levels(id) ON DELETE CASCADE,
    
    academic_year VARCHAR(20) NOT NULL, -- e.g., "2023-2024"
    is_active BOOLEAN DEFAULT TRUE,

    UNIQUE (teacher_id, subject_id, grade_level_id, academic_year)
);

-- 5. Groups (Cohorts within an Offering)
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offering_id UUID REFERENCES offerings(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- e.g., "Group A", "Sunday Morning"
    
    max_capacity INTEGER,
    schedule_description TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Enrollment (Student + Group)
CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    
    enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'suspended')),

    UNIQUE (student_id, group_id)
);

-- 7. Tracking Data (Linked to Enrollment)
CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
    notes TEXT,
    
    UNIQUE (enrollment_id, date)
);

CREATE TABLE IF NOT EXISTS assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    offering_id UUID REFERENCES offerings(id) ON DELETE CASCADE, -- Defined at Offering level
    title VARCHAR(255) NOT NULL,
    total_marks DECIMAL(5,2) NOT NULL,
    date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS grades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assessment_id UUID REFERENCES assessments(id) ON DELETE CASCADE,
    enrollment_id UUID REFERENCES enrollments(id) ON DELETE CASCADE, -- Student result
    score DECIMAL(5,2),
    
    UNIQUE (assessment_id, enrollment_id)
);

-- 8. Parents (For WhatsApp Communication)
CREATE TABLE IF NOT EXISTS parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL, -- Used for WhatsApp ID lookup
    email VARCHAR(255),
    relationship VARCHAR(50), -- 'father', 'mother', etc.
    is_primary BOOLEAN DEFAULT FALSE,
    preferred_language VARCHAR(10) DEFAULT 'ar',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS Policies (Draft)
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
