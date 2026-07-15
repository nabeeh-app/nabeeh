const { supabaseAdmin } = require('../config/database');

/**
 * Verify that a student belongs to the authenticated teacher via enrollment.
 * Uses the direct teacher_id column on enrollments (simplest pattern).
 * Returns the enrollment record if access is granted, null otherwise.
 */
async function verifyStudentAccess(studentId, teacherId) {
  const { data, error } = await supabaseAdmin
    .from('enrollments')
    .select('id, student_id, group_id, status')
    .eq('student_id', studentId)
    .eq('teacher_id', teacherId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data;
}

/**
 * Verify that an offering belongs to the authenticated teacher.
 * Returns the offering if access is granted, null otherwise.
 */
async function verifyOfferingAccess(offeringId, teacherId) {
  const { data, error } = await supabaseAdmin
    .from('offerings')
    .select('id, teacher_id')
    .eq('id', offeringId)
    .eq('teacher_id', teacherId)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Verify that a group belongs to the authenticated teacher's offering.
 * Returns the group with offering info if access is granted, null otherwise.
 */
async function verifyGroupAccess(groupId, teacherId) {
  const { data, error } = await supabaseAdmin
    .from('groups')
    .select('id, offering_id, offerings!inner(id, teacher_id)')
    .eq('id', groupId)
    .eq('offerings.teacher_id', teacherId)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Get all enrollment IDs for a teacher's students.
 * Returns minimal enrollment records (id, student_id, group_id).
 */
async function getTeacherEnrollmentIds(teacherId) {
  const { data, error } = await supabaseAdmin
    .from('enrollments')
    .select('id, student_id, group_id')
    .eq('teacher_id', teacherId)
    .not('student_id', 'is', null);

  if (error) return [];
  return data || [];
}

/**
 * Get all students for a teacher through the enrollment chain.
 * Returns enrollments with full student, group, offering, and subject info.
 * Used by getStudents route.
 */
async function getTeacherStudents(teacherId) {
  const { data, error } = await supabaseAdmin
    .from('students')
    .select(`
      *,
      enrollments!inner (
        id,
        status,
        teacher_id,
        group:groups!inner (
          id,
          name,
          offering:offerings!inner (
            id,
            academic_year,
            subject:subjects(name_en, name_ar)
          )
        )
      ),
      parents (
        id,
        name,
        phone,
        relationship,
        is_primary,
        preferred_language
      )
    `)
    .eq('enrollments.teacher_id', teacherId)
    .order('created_at', { ascending: false });

  if (error) return [];
  return data || [];
}

/**
 * Get student enrollments with details for a teacher.
 * Returns enrollments with student, group, offering, and subject info.
 * Used when verifying access to a specific student.
 */
async function getStudentEnrollmentsForTeacher(studentId, teacherId) {
  const { data, error } = await supabaseAdmin
    .from('enrollments')
    .select(`
      id, student_id, group_id, enrolled_at, status,
      students(id, name, name_ar, phone, parent_phone, student_code, status),
      group:groups!inner (
        id,
        name,
        offering:offerings!inner (
          id,
          teacher_id,
          subject_id,
          grade_level,
          subjects(id, name_en, name_ar)
        )
      )
    `)
    .eq('student_id', studentId)
    .eq('teacher_id', teacherId);

  if (error) return [];
  return data || [];
}

/**
 * Create a query builder for listing students for a teacher.
 * Returns the base Supabase query with enrollment chain joins and teacher filter applied.
 * The caller can chain additional filters (search, status, group_id) and pagination.
 */
function createStudentsQuery(teacherId) {
  return supabaseAdmin
    .from('students')
    .select(`
      *,
      enrollments!inner (
        id,
        status,
        teacher_id,
        group:groups!inner (
          id,
          name,
          offering:offerings!inner (
            id,
            academic_year,
            subject:subjects(name_en, name_ar)
          )
        )
      ),
      parents (
        id,
        name,
        phone,
        relationship,
        is_primary,
        preferred_language
      )
    `)
    .eq('enrollments.teacher_id', teacherId)
    .order('created_at', { ascending: false });
}

module.exports = {
  verifyStudentAccess,
  verifyOfferingAccess,
  verifyGroupAccess,
  getTeacherEnrollmentIds,
  getTeacherStudents,
  getStudentEnrollmentsForTeacher,
  createStudentsQuery,
};
