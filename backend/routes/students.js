const express = require('express');
const { supabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../lib/logger');

const router = express.Router();

// @desc    Get all students for a teacher
// @route   GET /api/students
// @access  Private
// @desc    Get all students for a teacher (via Active Enrollments)
// @route   GET /api/students
// @access  Private
const getStudents = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, grade, status = 'active' } = req.query;
    const offset = (page - 1) * limit;

    // Filter by Teacher's Offerings
    // We select students who have an enrollment in a group belonging to an offering owned by the teacher
    let query = supabase
      .from('students')
      .select(`
        *,
        enrollments!inner (
            id,
            status,
            group:groups!inner (
                id,
                name,
                offering:offerings!inner (
                    id, 
                    academic_year,
                    subject:subjects(name_en, name_ar),
                    teacher_id
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
      .eq('enrollments.group.offering.teacher_id', req.user.id) // Filter by logged-in teacher
      .order('created_at', { ascending: false });

    // Optional: Filter by specific Group
    if (req.query.group_id) {
      query = query.eq('enrollments.group_id', req.query.group_id);
    }

    // Add search filter
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    // Filter by enrollment status (not student status anymore, traditionally)
    // But schema has status on enrollments
    if (status) {
      query = query.eq('enrollments.status', status);
    }

    // Add pagination
    query = query.range(offset, offset + limit - 1);

    const { data: students, error, count } = await query;

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      data: students,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count, // Count might be approximate with complex joins in Supabase, needing separate count query usually
        pages: count ? Math.ceil(count / limit) : 0
      }
    });
  } catch (error) {
    logger.error('Get students error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error fetching students'
    });
  }
};

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private
const getStudent = async (req, res) => {
  try {
    // Verify access via Enrollment check
    const { data: student, error } = await supabase
      .from('students')
      .select(`
        *,
        parents (*),
        enrollments!inner (
            id,
            status,
            group:groups!inner (
                id, name,
                offering:offerings!inner ( teacher_id, subject:subjects(*) )
            )
        ),
        attendance_records:enrollments (
            attendance (*)
        ),
        grade_records:enrollments (
            grades (
                score,
                assessment:assessments (title, total_marks, date)
            )
        )
      `)
      .eq('id', req.params.id)
      .eq('enrollments.group.offering.teacher_id', req.user.id)
      .single();

    if (error || !student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Transform response to flat structure if needed, or return as is (nested is better for new UI)
    res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    logger.error('Get student error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error fetching student'
    });
  }
};

// @desc    Create new student and enroll in group
// @route   POST /api/students
// @access  Private
const createStudent = async (req, res) => {
  try {
    const {
      student_id, // external code
      name,
      phone,
      group_id, // REQUIRED now
      parents
    } = req.body;

    // Validate required fields
    if (!name || !group_id) {
      return res.status(400).json({
        success: false,
        message: 'Student name and Group ID are required'
      });
    }

    // Verify Group Ownership (Security)
    const { data: groupCheck } = await supabase
      .from('groups')
      .select('offering:offerings(teacher_id)')
      .eq('id', group_id)
      .single();

    if (!groupCheck || groupCheck.offering.teacher_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Unauthorized to add to this group' });
    }

    // 1. Create Student
    const { data: student, error: studentError } = await supabase
      .from('students')
      .insert([{
        student_code: student_id || `ST-${Date.now()}`,
        name,
        phone
      }])
      .select()
      .single();

    if (studentError) throw studentError;

    // 2. Create Enrollment
    const { error: enrollError } = await supabase
      .from('enrollments')
      .insert({
        student_id: student.id,
        group_id: group_id,
        status: 'active'
      });

    if (enrollError) throw enrollError;

    // 3. Create parents if provided
    if (parents && parents.length > 0) {
      const parentsData = parents.map(parent => ({
        student_id: student.id,
        name: parent.name,
        phone: parent.phone,
        email: parent.email,
        relationship: parent.relationship,
        is_primary: parent.is_primary || false,
        preferred_language: parent.preferred_language || 'ar'
      }));

      await supabase.from('parents').insert(parentsData);
    }

    res.status(201).json({
      success: true,
      data: student,
      message: 'Student created and enrolled successfully'
    });
  } catch (error) {
    logger.error('Create student error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message || 'Server error creating student'
    });
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private
const updateStudent = async (req, res) => {
  try {
    const allowedFields = ['student_code', 'name', 'phone'];
    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Check ownership via finding ANY enrollment with this teacher
    // For simplicity, we assume if you can getStudent() you can update.
    // But strict check:
    const { count } = await supabase
      .from('enrollments')
      .select('id, group:groups!inner(offering:offerings!inner(teacher_id))', { count: 'exact', head: true })
      .eq('student_id', req.params.id)
      .eq('group.offering.teacher_id', req.user.id);

    if (count === 0) return res.status(403).json({ success: false, message: 'Unauthorized' });

    const { data: student, error } = await supabase
      .from('students')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      data: student
    });
  } catch (error) {
    logger.error('Update student error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Delete student (Remove Enrollment or Delete if Orphan?)
// @route   DELETE /api/students/:id
// @access  Private
const deleteStudent = async (req, res) => {
  try {
    // Strategy: Delete enrollments for this teacher.
    // If we want to fully delete the student, we should check if they have other enrollments? 
    // Core Rules didn't specify behavior for multi-teacher students, but safest is:
    // Delete the enrollments associated with this teacher.
    // If "delete student" implies full removal from system, do that.
    // For now, let's delete the specific enrollments for this teacher's groups.

    // Find enrollments for this teacher
    const { data: enrollments } = await supabase
      .from('enrollments')
      .select('id, group:groups!inner(offering:offerings!inner(teacher_id))')
      .eq('student_id', req.params.id)
      .eq('group.offering.teacher_id', req.user.id);

    if (!enrollments || enrollments.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found in your classes' });
    }

    const enrollmentIds = enrollments.map(e => e.id);

    // Delete enrollments
    const { error } = await supabase
      .from('enrollments')
      .delete()
      .in('id', enrollmentIds);

    if (error) throw error;

    // Check if student has remaining enrollments?
    // Optionally delete student if no enrollments left (Clean up)

    res.status(200).json({
      success: true,
      message: 'Student removed from your classes'
    });
  } catch (error) {
    logger.error('Delete student error', { error: error.message });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get student statistics
// @route   GET /api/students/:id/stats
// @access  Private
const getStudentStats = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify access
    // Student -> Enrollment -> Group -> Offering -> Teacher
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select(`
            id,
            group:groups!inner(
                offering:offerings!inner(teacher_id)
            )
        `)
      .eq('student_id', id)
      .eq('groups.offerings.teacher_id', req.user.id);

    if (enrollError || !enrollments || enrollments.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found or unauthorized' });
    }

    const enrollmentIds = enrollments.map(e => e.id);

    // 1. Attendance Stats
    const { data: attendance } = await supabase
      .from('attendance')
      .select('status')
      .in('enrollment_id', enrollmentIds);

    const attendanceStats = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total_days: 0,
      attendance_percentage: 0
    };

    attendance?.forEach(a => {
      if (attendanceStats[a.status] !== undefined) {
        attendanceStats[a.status]++;
      }
      attendanceStats.total_days++;
    });

    if (attendanceStats.total_days > 0) {
      // Assuming Present/Late/Excused count as present-ish? Usually percentage is (Present) / Total?
      // Or (Total - Absent) / Total.
      const presentCount = attendanceStats.present + attendanceStats.late; // Conservative
      attendanceStats.attendance_percentage = Math.round((presentCount / attendanceStats.total_days) * 100);
    }

    // 2. Academic Stats (Grades)
    // Get average score across all assessments?
    const { data: grades } = await supabase
      .from('grades')
      .select(`
            score,
            assessment:assessments(total_marks)
        `)
      .in('enrollment_id', enrollmentIds);

    let academicStats = {
      average_score: 0,
      total_assessments: 0
    };

    if (grades && grades.length > 0) {
      let totalPct = 0;
      grades.forEach(g => {
        if (g.assessment?.total_marks) {
          totalPct += (g.score / g.assessment.total_marks) * 100;
        }
      });
      academicStats.total_assessments = grades.length;
      academicStats.average_score = Math.round((totalPct / grades.length) * 100) / 100;
    }

    res.status(200).json({
      success: true,
      data: {
        attendance: attendanceStats,
        academic: academicStats
      }
    });

  } catch (error) {
    logger.error('Get student stats error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching stats' });
  }
};

// Route definitions
router.get('/', authenticateToken, getStudents);
router.get('/:id', authenticateToken, getStudent);
router.post('/', authenticateToken, createStudent);
router.put('/:id', authenticateToken, updateStudent);
router.delete('/:id', authenticateToken, deleteStudent);
router.get('/:id/stats', authenticateToken, getStudentStats);

module.exports = router;
