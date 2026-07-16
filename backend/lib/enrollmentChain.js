const { supabase } = require('../config/database');
const logger = require('./logger');

/**
 * Verify that a student belongs to the authenticated teacher via enrollment.
 * Uses the direct teacher_id column on enrollments (simplest pattern).
 * Returns the enrollment record if access is granted, null otherwise.
 */
async function verifyStudentAccess(studentId, teacherId) {
  const { data, error } = await supabase
    .from('enrollments')
    .select('id, student_id, group_id, status')
    .eq('student_id', studentId)
    .eq('teacher_id', teacherId)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) logger.error('verifyStudentAccess query failed', { error: error.message, studentId, teacherId });
    return null;
  }
  return data;
}

/**
 * Verify that an offering belongs to the authenticated teacher.
 * Returns the offering if access is granted, null otherwise.
 */
async function verifyOfferingAccess(offeringId, teacherId) {
  const { data, error } = await supabase
    .from('offerings')
    .select('id, teacher_id')
    .eq('id', offeringId)
    .eq('teacher_id', teacherId)
    .single();

  if (error || !data) {
    if (error) logger.error('verifyOfferingAccess query failed', { error: error.message, offeringId, teacherId });
    return null;
  }
  return data;
}

/**
 * Verify that a group belongs to the authenticated teacher's offering.
 * Returns the group with offering info if access is granted, null otherwise.
 */
async function verifyGroupAccess(groupId, teacherId) {
  const { data, error } = await supabase
    .from('groups')
    .select('id, offering_id, offerings!inner(id, teacher_id)')
    .eq('id', groupId)
    .eq('offerings.teacher_id', teacherId)
    .single();

  if (error || !data) {
    if (error) logger.error('verifyGroupAccess query failed', { error: error.message, groupId, teacherId });
    return null;
  }
  return data;
}

/**
 * Get all enrollments for a teacher's students.
 * Returns minimal enrollment records (id, student_id, group_id).
 */
async function getTeacherEnrollments(teacherId) {
  const { data, error } = await supabase
    .from('enrollments')
    .select('id, student_id, group_id')
    .eq('teacher_id', teacherId)
    .not('student_id', 'is', null);

  if (error) {
    logger.error('getTeacherEnrollments query failed', { error: error.message, teacherId });
    return [];
  }
  return data || [];
}

/**
 * Get all students for a teacher through the enrollment chain.
 * Returns enrollments with full student, group, offering, and subject info.
 * Used by getStudents route.
 */
async function getTeacherStudents(teacherId) {
  const { data, error } = await supabase
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

  if (error) {
    logger.error('getTeacherStudents query failed', { error: error.message, teacherId });
    return [];
  }
  return data || [];
}

/**
 * Get student enrollments with details for a teacher.
 * Returns enrollments with student, group, offering, and subject info.
 * Used when verifying access to a specific student.
 */
async function getStudentEnrollmentsForTeacher(studentId, teacherId) {
  const { data, error } = await supabase
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

  if (error) {
    logger.error('getStudentEnrollmentsForTeacher query failed', { error: error.message, studentId, teacherId });
    return [];
  }
  return data || [];
}

/**
 * Create a query builder for listing students for a teacher.
 * Returns the base Supabase query with enrollment chain joins and teacher filter applied.
 * The caller can chain additional filters (search, status, group_id) and pagination.
 */
function createStudentsQuery(teacherId) {
  return supabase
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

/**
 * Batch resolve enrollment IDs for student/group pairs under a teacher.
 * Accepts arrays of student IDs and group IDs.
 * Returns a Map keyed by "studentId_groupId" → enrollment ID.
 */
async function batchResolveEnrollments(studentIds, groupIds, teacherId) {
  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select('id, student_id, group_id')
    .in('group_id', groupIds)
    .in('student_id', studentIds)
    .eq('teacher_id', teacherId);

  if (error) {
    logger.error('batchResolveEnrollments query failed', { error: error.message, teacherId });
    return new Map();
  }

  const map = new Map();
  (enrollments || []).forEach(e => {
    map.set(`${e.student_id}_${e.group_id}`, e.id);
  });
  return map;
}

/**
 * Batch resolve enrollments with offering and subject info for a teacher.
 * Accepts an array of student IDs.
 * Returns enrollment records with enrollment_id, offering_id, and subject details.
 * Used by grades bulk import.
 */
async function batchResolveEnrollmentsWithOfferings(studentIds, teacherId) {
  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      student_id,
      group:groups!inner(
        offering:offerings!inner(
          id,
          teacher_id,
          subject:subjects!inner(id, name_en, name_ar, code)
        )
      )
    `)
    .in('student_id', studentIds)
    .eq('groups.offerings.teacher_id', teacherId);

  if (error) {
    logger.error('batchResolveEnrollmentsWithOfferings query failed', { error: error.message, teacherId });
    return [];
  }
  return enrollments || [];
}

module.exports = {
  verifyStudentAccess,
  verifyOfferingAccess,
  verifyGroupAccess,
  getTeacherEnrollments,
  getTeacherStudents,
  getStudentEnrollmentsForTeacher,
  createStudentsQuery,
  batchResolveEnrollments,
  batchResolveEnrollmentsWithOfferings,
};
