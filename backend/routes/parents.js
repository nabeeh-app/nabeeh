const express = require('express');
const supabase = require('../config/database').supabaseAdmin;
const { authenticateToken } = require('../middleware/auth');
const { validate, createParentSchema, updateParentSchema } = require('../middleware/validate');
const logger = require('../lib/logger');

const router = express.Router();

// @desc    Get parents for teacher's students
// @route   GET /api/parents
// @access  Private
const getParents = async (req, res) => {
  try {
    const { student_id, search } = req.query;
    const teacher_id = req.user.id;

    // Step 1: Get Teacher's Student IDs via direct teacher_id filter
    const { data: teacherStudents, error: studentError } = await supabase
      .from('enrollments')
      .select('student_id')
      .eq('teacher_id', teacher_id)
      .not('student_id', 'is', null);

    const studentIds = new Set(teacherStudents?.map(e => e.student_id) || []);

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

// @desc    Get single parent by ID
// @route   GET /api/parents/:id
// @access  Private
const getParent = async (req, res) => {
  try {
    const { data: parent, error } = await supabase
      .from('parents')
      .select(`
        *,
        student:students (id, name, student_id)
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !parent) {
      return res.status(404).json({ success: false, message: 'Parent not found' });
    }

    // Verify ownership via enrollment
    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', parent.student_id)
      .eq('teacher_id', req.user.id)
      .limit(1);

    if (!enrollment || enrollment.length === 0) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    res.status(200).json({ success: true, data: parent });
  } catch (error) {
    logger.error('Get parent error', { error: error.message });
    res.status(500).json({ success: false, message: 'Server error fetching parent' });
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
    const { data: enrollments, error: enrollError } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', student_id)
      .eq('teacher_id', req.user.id)
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
    const { data: accessCheck } = await supabase
      .from('parents')
      .select('student_id')
      .eq('id', req.params.id)
      .single();

    if (!accessCheck) {
      return res.status(404).json({ success: false, message: 'Parent not found' });
    }

    const { data: enrollment } = await supabase
      .from('enrollments')
      .select('id')
      .eq('student_id', accessCheck.student_id)
      .eq('teacher_id', req.user.id)
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
      .select('id')
      .eq('student_id', parent.student_id)
      .eq('teacher_id', req.user.id)
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

/**
 * @openapi
 * /api/parents/:
 *   get:
 *     tags: [Parents]
 *     summary: List parents
 *     description: Get all parents for the logged-in teacher's enrolled students. Supports filtering by student_id and search by name/phone.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: student_id
 *         required: false
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter parents by student ID
 *       - in: query
 *         name: search
 *         required: false
 *         schema:
 *           type: string
 *         description: Search by parent name or phone (case-insensitive)
 *     responses:
 *       200:
 *         description: List of parents retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Parent'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/', authenticateToken, getParents);

/**
 * @openapi
 * /api/parents/{id}:
 *   get:
 *     tags: [Parents]
 *     summary: Get single parent
 *     description: Retrieve a single parent by ID. Verifies the parent belongs to a student enrolled with the authenticated teacher.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The parent ID
 *     responses:
 *       200:
 *         description: Parent retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Parent'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       403:
 *         description: Unauthorized — student not enrolled with teacher
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Parent not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/:id', authenticateToken, getParent);

/**
 * @openapi
 * /api/parents/:
 *   post:
 *     tags: [Parents]
 *     summary: Create parent
 *     description: Create a new parent contact linked to a student. The student must be enrolled with the authenticated teacher.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [student_id, name, phone, relationship]
 *             properties:
 *               student_id:
 *                 type: string
 *                 format: uuid
 *                 description: The student ID this parent is linked to
 *               name:
 *                 type: string
 *                 description: Parent full name
 *               phone:
 *                 type: string
 *                 description: Parent phone number (with country code)
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Parent email address
 *               relationship:
 *                 type: string
 *                 description: Relationship to student (e.g. father, mother)
 *               preferred_language:
 *                 type: string
 *                 enum: [ar, en]
 *                 description: Preferred communication language
 *               is_primary:
 *                 type: boolean
 *                 description: Whether this is the primary contact
 *     responses:
 *       201:
 *         description: Parent created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Parent'
 *       400:
 *         description: Validation error or missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Student not found or not enrolled with teacher
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.post('/', authenticateToken, validate(createParentSchema), createParent);

/**
 * @openapi
 * /api/parents/{id}:
 *   put:
 *     tags: [Parents]
 *     summary: Update parent
 *     description: Update a parent's information. Only provided fields are updated. Verifies ownership via enrollment chain.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The parent ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Parent full name
 *               phone:
 *                 type: string
 *                 description: Parent phone number
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Parent email address
 *               relationship:
 *                 type: string
 *                 description: Relationship to student
 *               preferred_language:
 *                 type: string
 *                 enum: [ar, en]
 *                 description: Preferred communication language
 *               is_primary:
 *                 type: boolean
 *                 description: Whether this is the primary contact
 *               telegram_username:
 *                 type: string
 *                 description: Telegram username
 *               communication_preferences:
 *                 type: object
 *                 description: Communication preferences object
 *     responses:
 *       200:
 *         description: Parent updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Parent'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       403:
 *         description: Unauthorized — student not enrolled with teacher
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Parent not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.put('/:id', authenticateToken, validate(updateParentSchema), updateParent);

/**
 * @openapi
 * /api/parents/{id}:
 *   delete:
 *     tags: [Parents]
 *     summary: Delete parent
 *     description: Permanently delete a parent contact. Verifies ownership via enrollment chain.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The parent ID
 *     responses:
 *       200:
 *         description: Parent deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       403:
 *         description: Unauthorized — student not enrolled with teacher
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Parent not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.delete('/:id', authenticateToken, deleteParent);

module.exports = router;
