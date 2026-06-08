const express = require('express');
const { supabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../lib/logger');

const router = express.Router();

// @desc    Get parents for teacher's students
// @route   GET /api/parents
// @access  Private
const getParents = async (req, res) => {
  try {
    const { student_id, search } = req.query;
    const teacher_id = req.user.id;

    // Step 1: Get Teacher's Student IDs
    const { data: teacherStudents, error: studentError } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('groups.offerings.teacher_id', teacher_id) // This relies on deep join or we do 2 steps
      // Supabase PostgREST deep filter:
      .not('student_id', 'is', null);

    // Actually, let's use the RPC or a direct join if possible, but JS logic is safest given PostgREST limits on deep nested filtering syntax sometimes.
    // Let's try the direct "Exists" filter approach if possible, but PostgREST doesn't support EXISTS easily in JS client without foreign keys setup perfectly.

    // Let's use the known working pattern from students.js:
    // Fetch all offerings -> groups -> enrollments to get student IDs.
    const { data: offerings } = await supabase
      .from('offerings')
      .select('groups(enrollments(student_id))')
      .eq('teacher_id', teacher_id);

    const studentIds = new Set();
    offerings?.forEach(o =>
      o.groups?.forEach(g =>
        g.enrollments?.forEach(e =>
          studentIds.add(e.student_id)
        )
      )
    );

    if (studentIds.size === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Step 2: Fetch Parents
    let parentQuery = supabase
      .from('parents')
      .select(`
            *,
            student:students (id, name, student_id)
        `)
      .in('student_id', Array.from(studentIds));

    if (student_id) {
      if (!studentIds.has(student_id)) {
        return res.status(403).json({ success: false, message: 'Unauthorized access to student' });
      }
      parentQuery = parentQuery.eq('student_id', student_id);
    }

    if (search) {
      parentQuery = parentQuery.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: parents, error } = await parentQuery;

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      data: parents
    });
  } catch (error) {
    logger.error('Get parents error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error fetching parents'
    });
  }
};

// @desc    Create new parent
// @route   POST /api/parents
// @access  Private
const createParent = async (req, res) => {
  try {
    const {
      student_id,
      name,
      phone,
      email,
      relationship,
      is_primary = false,
      preferred_language = 'ar'
    } = req.body;

    // Validate required fields
    if (!student_id || !name || !phone || !relationship) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: student_id, name, phone, relationship'
      });
    }

    // Verify student belongs to teacher (Enrollment Check)
    // Find if student has ANY enrollment in teacher's offerings
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('id, groups!inner(offerings!inner(teacher_id))')
      .eq('student_id', student_id)
      .eq('groups.offerings.teacher_id', req.user.id)
      .limit(1);

    if (enrollError || !enrollments || enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found or not enrolled in your classes'
      });
    }

    const { data: parent, error } = await supabase
      .from('parents')
      .insert([{
        student_id,
        name,
        phone,
        email,
        relationship,
        is_primary,
        preferred_language
      }])
      .select(`
        *,
        student:students (name, student_id)
      `)
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(201).json({
      success: true,
      data: parent
    });
  } catch (error) {
    logger.error('Create parent error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error creating parent'
    });
  }
};

// @desc    Update parent
// @route   PUT /api/parents/:id
// @access  Private
const updateParent = async (req, res) => {
  try {
    const allowedFields = [
      'name', 'phone', 'email', 'relationship',
      'is_primary', 'preferred_language', 'telegram_username',
      'communication_preferences'
    ];

    const updates = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    // Verify Authorization: Check if parent belongs to a student enrolled with this teacher
    // Fetch parent -> student -> enrollments
    const { data: parentCheck, error: checkError } = await supabase
      .from('parents')
      .select(`
            id,
            student_id,
            student:students!inner (
                enrollments!inner (
                    groups!inner (
                        offerings!inner (
                            teacher_id
                        )
                    )
                )
            )
        `)
      .eq('id', req.params.id)
      .eq('student.enrollments.groups.offerings.teacher_id', req.user.id)
      .single();

    // Wait, deep filtering in .eq() like that is not standard Supabase JS unless embedding.
    // Correct approach using !inner joins automatically filters:
    // If the join chain doesn't match the inner constraint on teacher_id, no row is returned.

    // HOWEVER, the teacher_id is on OFFERINGS.
    // So we need to filter on offerings.teacher_id.

    // Let's create a specialized check query
    const { data: accessCheck } = await supabase
      .from('parents')
      .select('student_id')
      .eq('id', req.params.id)
      .single();

    if (!accessCheck) {
      return res.status(404).json({ success: false, message: 'Parent not found' });
    }

    // Now check student enrollment
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('groups!inner(offerings!inner(teacher_id))')
      .eq('student_id', accessCheck.student_id)
      .eq('groups.offerings.teacher_id', req.user.id)
      .limit(1);

    if (!enrollment || enrollment.length === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const { data: parent, error } = await supabase
      .from('parents')
      .update(updates)
      .eq('id', req.params.id)
      .select(`
        *,
        student:students (name, student_id)
      `)
      .single();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      data: parent
    });
  } catch (error) {
    logger.error('Update parent error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error updating parent'
    });
  }
};

// @desc    Delete parent
// @route   DELETE /api/parents/:id
// @access  Private
const deleteParent = async (req, res) => {
  try {
    // First verify the parent belongs to teacher's student
    const { data: parent } = await supabase
      .from('parents')
      .select('student_id')
      .eq('id', req.params.id)
      .single();

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found'
      });
    }

    // Check auth via enrollment
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('groups!inner(offerings!inner(teacher_id))')
      .eq('student_id', parent.student_id)
      .eq('groups.offerings.teacher_id', req.user.id)
      .limit(1);

    if (!enrollment || enrollment.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { error } = await supabase
      .from('parents')
      .delete()
      .eq('id', req.params.id);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Parent deleted successfully'
    });
  } catch (error) {
    logger.error('Delete parent error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error deleting parent'
    });
  }
};

// Route definitions
router.get('/', authenticateToken, getParents);
router.post('/', authenticateToken, createParent);
router.put('/:id', authenticateToken, updateParent);
router.delete('/:id', authenticateToken, deleteParent);

module.exports = router;
