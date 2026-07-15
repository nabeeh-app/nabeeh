-- Migration 020: Drop unused database views from migration 009
-- These views (teacher_students, teacher_student_stats, conversation_details)
-- are not referenced by any backend code.

DROP VIEW IF EXISTS conversation_details;
DROP VIEW IF EXISTS teacher_student_stats;
DROP VIEW IF EXISTS teacher_students;
