const express = require('express');
const { supabase, supabaseAdmin } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate, createParentSchema, updateParentSchema } = require('../middleware/validate');
const { verifyStudentAccess, getTeacherEnrollments } = require('../lib/enrollmentChain');
const logger = require('../lib/logger');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// @desc    Get parents for teacher's students
// @route   GET /api/parents
// @access  Private
const getParents = async (req, res) => {
  const { student_id, search } = req.query;
  const teacher_id = req.user.id;

  const enrollments = await getTeacherEnrollments(teacher_id);
  const studentIds = new Set(enrollments.map(e => e.student_id));

  if (studentIds.size === 0) {
    return res.status(200).json({ success: true, data: [] });
  }

  let parentQuery = supabase
    .from('parents')
    .select(`
          *,
          student:students (id, name, student_id)
      `)
    .in('student_id', Array.from(studentIds));

  if (student_id) {
    if (!studentIds.has(student_id)) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to student', messageAr: 'غير مصرح بالوصول إلى هذا الطالب', code: 'FORBIDDEN' });
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
      message: error.message,
      messageAr: 'فشل في جلب أولياء الأمور',
      code: 'DATABASE_ERROR'
    });
  }

  res.status(200).json({
    success: true,
    data: parents
  });
};

// @desc    Get single parent by ID
// @route   GET /api/parents/:id
// @access  Private
const getParent = async (req, res) => {
  const { data: parent, error } = await supabase
    .from('parents')
    .select(`
      *,
      student:students (id, name, student_id)
    `)
    .eq('id', req.params.id)
    .single();

  if (error || !parent) {
    return res.status(404).json({ success: false, message: 'Parent not found', messageAr: 'لم يتم العثور على ولي الأمر', code: 'NOT_FOUND' });
  }

  const enrollment = await verifyStudentAccess(parent.student_id, req.user.id);
  if (!enrollment) {
    return res.status(403).json({ success: false, message: 'Unauthorized', messageAr: 'غير مصرح', code: 'FORBIDDEN' });
  }

  res.status(200).json({ success: true, data: parent });
};

// @desc    Create new parent
// @route   POST /api/parents
// @access  Private
const createParent = async (req, res) => {
  const {
    student_id,
    name,
    phone,
    email,
    relationship,
    is_primary = false,
    preferred_language = 'ar'
  } = req.body;

  if (!student_id || !name || !phone || !relationship) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: student_id, name, phone, relationship',
      messageAr: 'حقول مطلوبة مفقودة: معرّف الطالب، الاسم، الهاتف، العلاقة',
      code: 'VALIDATION_ERROR'
    });
  }

  const enrollment = await verifyStudentAccess(student_id, req.user.id);
  if (!enrollment) {
    return res.status(404).json({
      success: false,
      message: 'Student not found or not enrolled in your classes',
      messageAr: 'لم يتم العثور على الطالب أو غير مسجّل في فصولك',
      code: 'NOT_FOUND'
    });
  }

  const { data: parent, error } = await supabaseAdmin
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
      message: error.message,
      messageAr: 'فشل في إنشاء ولي الأمر',
      code: 'VALIDATION_ERROR'
    });
  }

  res.status(201).json({
    success: true,
    data: parent
  });
};

// @desc    Update parent
// @route   PUT /api/parents/:id
// @access  Private
const updateParent = async (req, res) => {
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

  const { data: accessCheck } = await supabase
    .from('parents')
    .select('student_id')
    .eq('id', req.params.id)
    .single();

  if (!accessCheck) {
    return res.status(404).json({ success: false, message: 'Parent not found', messageAr: 'لم يتم العثور على ولي الأمر', code: 'NOT_FOUND' });
  }

  const enrollment = await verifyStudentAccess(accessCheck.student_id, req.user.id);
  if (!enrollment) {
    return res.status(403).json({ success: false, message: 'Unauthorized', messageAr: 'غير مصرح', code: 'FORBIDDEN' });
  }

  const { data: parent, error } = await supabaseAdmin
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
      message: error.message,
      messageAr: 'فشل في تحديث ولي الأمر',
      code: 'VALIDATION_ERROR'
    });
  }

  res.status(200).json({
    success: true,
    data: parent
  });
};

// @desc    Delete parent
// @route   DELETE /api/parents/:id
// @access  Private
const deleteParent = async (req, res) => {
  const { data: parent } = await supabase
    .from('parents')
    .select('student_id')
    .eq('id', req.params.id)
    .single();

  if (!parent) {
    return res.status(404).json({
      success: false,
      message: 'Parent not found',
      messageAr: 'لم يتم العثور على ولي الأمر',
      code: 'NOT_FOUND'
    });
  }

  const enrollment = await verifyStudentAccess(parent.student_id, req.user.id);
  if (!enrollment) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized',
      messageAr: 'غير مصرح',
      code: 'FORBIDDEN'
    });
  }

  const { error } = await supabaseAdmin
    .from('parents')
    .delete()
    .eq('id', req.params.id);

  if (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
      messageAr: 'فشل في حذف ولي الأمر',
      code: 'VALIDATION_ERROR'
    });
  }

  res.status(200).json({
    success: true,
    message: 'Parent deleted successfully'
  });
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
router.get('/', authenticateToken, asyncHandler(getParents));

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
router.get('/:id', authenticateToken, asyncHandler(getParent));

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
router.post('/', authenticateToken, validate(createParentSchema), asyncHandler(createParent));

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
router.put('/:id', authenticateToken, validate(updateParentSchema), asyncHandler(updateParent));

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
router.delete('/:id', authenticateToken, asyncHandler(deleteParent));

module.exports = router;
