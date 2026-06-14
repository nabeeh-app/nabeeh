const express = require('express');
const router = express.Router();
const supabase = require('../config/database').supabaseAdmin;
const { authenticateToken, requirePermission } = require('../middleware/auth');
const { validate, createOfferingSchema, createGroupSchema, updateGroupSchema } = require('../middleware/validate');
const logger = require('../lib/logger');

/**
 * @openapi
 * /api/offerings/:
 *   get:
 *     tags: [Offerings]
 *     summary: List offerings
 *     description: Get all offerings for the logged-in teacher, including subjects, grade levels, and groups.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of offerings retrieved successfully
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
 *                     $ref: '#/components/schemas/Offering'
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
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { data: offerings, error } = await supabase
            .from('offerings')
            .select(`
                id,
                academic_year,
                is_active,
                created_at,
                subject:subjects(id, name_en, name_ar, code),
                grade_level:grade_levels(id, name, order),
                groups:groups(id, name, max_capacity, schedule_description)
            `)
            .eq('teacher_id', req.user.id)
            .eq('is_active', true)
            .order('grade_level(order)');

        if (error) throw error;
        res.json({ success: true, data: offerings });
    } catch (error) {
        logger.error('Get offerings error', { error: error.message });
        res.status(500).json({ success: false, message: 'Failed to fetch offerings' });
    }
});

/**
 * @openapi
 * /api/offerings/{id}:
 *   get:
 *     tags: [Offerings]
 *     summary: Get offering with groups and enrollments
 *     description: Retrieve a single offering by ID, including its groups and enrolled students.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The offering ID
 *     responses:
 *       200:
 *         description: Offering retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Offering'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Offering not found
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
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { data: offering, error } = await supabase
            .from('offerings')
            .select(`
                id,
                academic_year,
                is_active,
                created_at,
                subject:subjects(id, name_en, name_ar, code),
                grade_level:grade_levels(id, name, order),
                groups:groups(
                    id, name, max_capacity, schedule_description,
                    enrollments(
                        id,
                        student:students(id, name, student_code, phone),
                        enrolled_at,
                        status
                    )
                )
            `)
            .eq('id', req.params.id)
            .eq('teacher_id', req.user.id)
            .single();

        if (error || !offering) {
            return res.status(404).json({ success: false, message: 'Offering not found' });
        }

        res.json({ success: true, data: offering });
    } catch (error) {
        logger.error('Get offering error', { error: error.message });
        res.status(500).json({ success: false, message: 'Failed to fetch offering' });
    }
});

/**
 * @openapi
 * /api/offerings/:
 *   post:
 *     tags: [Offerings]
 *     summary: Create offering
 *     description: Create a new offering for the logged-in teacher. Requires manage_offerings permission.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject_id, grade_level_id, academic_year]
 *             properties:
 *               subject_id:
 *                 type: string
 *                 format: uuid
 *                 description: Subject ID
 *               grade_level_id:
 *                 type: string
 *                 format: uuid
 *                 description: Grade level ID
 *               academic_year:
 *                 type: string
 *                 description: Academic year (e.g. 2025-2026)
 *     responses:
 *       201:
 *         description: Offering created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Offering'
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
 *       409:
 *         description: Offering already exists for this subject and grade level
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
router.post('/', authenticateToken, requirePermission('manage_offerings'), validate(createOfferingSchema), async (req, res) => {
    try {
        const { subject_id, grade_level_id, academic_year } = req.body;

        const { data: offering, error } = await supabase
            .from('offerings')
            .insert({
                teacher_id: req.user.id,
                subject_id,
                grade_level_id,
                academic_year
            })
            .select(`
                id,
                academic_year,
                is_active,
                subject:subjects(id, name_en, name_ar, code),
                grade_level:grade_levels(id, name, order)
            `)
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data: offering });
    } catch (error) {
        logger.error('Create offering error', { error: error.message });
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'Offering already exists for this subject and grade level' });
        }
        res.status(500).json({ success: false, message: 'Failed to create offering' });
    }
});

/**
 * @openapi
 * /api/offerings/{id}:
 *   delete:
 *     tags: [Offerings]
 *     summary: Delete offering (soft)
 *     description: Soft-delete an offering by setting is_active to false. Requires manage_offerings permission.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The offering ID
 *     responses:
 *       200:
 *         description: Offering deleted successfully
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
 *       404:
 *         description: Offering not found
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
router.delete('/:id', authenticateToken, requirePermission('manage_offerings'), async (req, res) => {
    try {
        const { data: offering, error: fetchError } = await supabase
            .from('offerings')
            .select('id')
            .eq('id', req.params.id)
            .eq('teacher_id', req.user.id)
            .single();

        if (fetchError || !offering) {
            return res.status(404).json({ success: false, message: 'Offering not found' });
        }

        const { error } = await supabase
            .from('offerings')
            .update({ is_active: false })
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true, message: 'Offering deleted successfully' });
    } catch (error) {
        logger.error('Delete offering error', { error: error.message });
        res.status(500).json({ success: false, message: 'Failed to delete offering' });
    }
});

/**
 * @openapi
 * /api/offerings/{offeringId}/groups:
 *   get:
 *     tags: [Offerings]
 *     summary: Get groups for offering
 *     description: Retrieve all groups for a given offering, including enrollments and active student counts.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offeringId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The offering ID
 *     responses:
 *       200:
 *         description: Groups retrieved successfully
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
 *                     $ref: '#/components/schemas/Group'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Offering not found
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
router.get('/:offeringId/groups', authenticateToken, async (req, res) => {
    try {
        const { data: offering } = await supabase
            .from('offerings')
            .select('id')
            .eq('id', req.params.offeringId)
            .eq('teacher_id', req.user.id)
            .single();

        if (!offering) {
            return res.status(404).json({ success: false, message: 'Offering not found' });
        }

        const { data: groups, error } = await supabase
            .from('groups')
            .select(`
                id, name, max_capacity, schedule_description,
                enrollments(
                    id,
                    student:students(id, name, student_code),
                    enrolled_at,
                    status
                )
            `)
            .eq('offering_id', req.params.offeringId)
            .order('name');

        if (error) throw error;

        const groupsWithCounts = groups.map(g => ({
            ...g,
            enrolled_count: g.enrollments?.filter(e => e.status === 'active').length || 0
        }));

        res.json({ success: true, data: groupsWithCounts });
    } catch (error) {
        logger.error('Get groups error', { error: error.message });
        res.status(500).json({ success: false, message: 'Failed to fetch groups' });
    }
});

/**
 * @openapi
 * /api/offerings/{offeringId}/groups:
 *   post:
 *     tags: [Offerings]
 *     summary: Create group
 *     description: Create a new group within an offering. Requires manage_offerings permission.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offeringId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The offering ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Group name
 *               max_capacity:
 *                 type: integer
 *                 description: Maximum student capacity
 *               schedule_description:
 *                 type: string
 *                 description: Schedule description (e.g. "Sun/Tue 4-6pm")
 *     responses:
 *       201:
 *         description: Group created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Group'
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
 *         description: Unauthorized — offering does not belong to teacher
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
router.post('/:offeringId/groups', authenticateToken, requirePermission('manage_offerings'), validate(createGroupSchema), async (req, res) => {
    try {
        const { name, max_capacity, schedule_description } = req.body;
        const { offeringId } = req.params;

        const { data: offering } = await supabase
            .from('offerings')
            .select('id')
            .eq('id', offeringId)
            .eq('teacher_id', req.user.id)
            .single();

        if (!offering) return res.status(403).json({ success: false, message: 'Unauthorized' });

        const { data: group, error } = await supabase
            .from('groups')
            .insert({
                offering_id: offeringId,
                name,
                max_capacity,
                schedule_description
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json({ success: true, data: group });
    } catch (error) {
        logger.error('Create group error', { error: error.message });
        res.status(500).json({ success: false, message: 'Failed to create group' });
    }
});

/**
 * @openapi
 * /api/offerings/{offeringId}/groups/{groupId}:
 *   put:
 *     tags: [Offerings]
 *     summary: Update group
 *     description: Update an existing group within an offering. Only provided fields are updated. Requires manage_offerings permission.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offeringId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The offering ID
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The group ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Group name
 *               max_capacity:
 *                 type: integer
 *                 description: Maximum student capacity
 *               schedule_description:
 *                 type: string
 *                 description: Schedule description
 *     responses:
 *       200:
 *         description: Group updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Group'
 *       400:
 *         description: No valid fields to update
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
 *         description: Unauthorized — offering does not belong to teacher
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
router.put('/:offeringId/groups/:groupId', authenticateToken, requirePermission('manage_offerings'), validate(updateGroupSchema), async (req, res) => {
    try {
        const { offeringId, groupId } = req.params;

        const { data: offering } = await supabase
            .from('offerings')
            .select('id')
            .eq('id', offeringId)
            .eq('teacher_id', req.user.id)
            .single();

        if (!offering) return res.status(403).json({ success: false, message: 'Unauthorized' });

        const allowedFields = ['name', 'max_capacity', 'schedule_description'];
        const updates = {};
        Object.keys(req.body).forEach(key => {
            if (allowedFields.includes(key)) {
                updates[key] = req.body[key];
            }
        });

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update' });
        }

        const { data: group, error } = await supabase
            .from('groups')
            .update(updates)
            .eq('id', groupId)
            .eq('offering_id', offeringId)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data: group });
    } catch (error) {
        logger.error('Update group error', { error: error.message });
        res.status(500).json({ success: false, message: 'Failed to update group' });
    }
});

/**
 * @openapi
 * /api/offerings/{offeringId}/groups/{groupId}/enroll:
 *   post:
 *     tags: [Offerings]
 *     summary: Enroll student in group
 *     description: Enroll a student in a group. Re-enrolls previously withdrawn students. Requires manage_offerings permission.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offeringId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The offering ID
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The group ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [student_id]
 *             properties:
 *               student_id:
 *                 type: string
 *                 format: uuid
 *                 description: The student ID to enroll
 *     responses:
 *       201:
 *         description: Student enrolled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Enrollment'
 *       400:
 *         description: Validation error or group at full capacity
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
 *         description: Unauthorized — offering does not belong to teacher
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Group not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       409:
 *         description: Student already enrolled
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
router.post('/:offeringId/groups/:groupId/enroll', authenticateToken, requirePermission('manage_offerings'), async (req, res) => {
    try {
        const { offeringId, groupId } = req.params;
        const { student_id } = req.body;

        if (!student_id) {
            return res.status(400).json({ success: false, message: 'student_id is required' });
        }

        // Verify ownership
        const { data: offering } = await supabase
            .from('offerings')
            .select('id')
            .eq('id', offeringId)
            .eq('teacher_id', req.user.id)
            .single();

        if (!offering) return res.status(403).json({ success: false, message: 'Unauthorized' });

        // Check group exists and belongs to offering
        const { data: group } = await supabase
            .from('groups')
            .select('id, max_capacity')
            .eq('id', groupId)
            .eq('offering_id', offeringId)
            .single();

        if (!group) return res.status(404).json({ success: false, message: 'Group not found' });

        // Check capacity
        if (group.max_capacity) {
            const { count } = await supabase
                .from('enrollments')
                .select('id', { count: 'exact', head: true })
                .eq('group_id', groupId)
                .eq('status', 'active');

            if (count >= group.max_capacity) {
                return res.status(400).json({ success: false, message: 'Group is at full capacity' });
            }
        }

        // Check if already enrolled
        const { data: existing } = await supabase
            .from('enrollments')
                .select('id, status')
                .eq('student_id', student_id)
                .eq('group_id', groupId)
                .single();

        if (existing && existing.status === 'active') {
            return res.status(409).json({ success: false, message: 'Student is already enrolled in this group' });
        }

        // Re-enroll if previously withdrawn, or create new
        let enrollment;
        if (existing) {
            const { data, error } = await supabase
                .from('enrollments')
                .update({ status: 'active', enrolled_at: new Date().toISOString() })
                .eq('id', existing.id)
                .select()
                .single();
            if (error) throw error;
            enrollment = data;
        } else {
            const { data, error } = await supabase
                .from('enrollments')
                .insert({
                    student_id,
                    group_id: groupId,
                    enrolled_at: new Date().toISOString()
                })
                .select()
                .single();
            if (error) throw error;
            enrollment = data;
        }

        res.status(201).json({ success: true, data: enrollment });
    } catch (error) {
        logger.error('Enroll student error', { error: error.message });
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'Student is already enrolled' });
        }
        res.status(500).json({ success: false, message: 'Failed to enroll student' });
    }
});

/**
 * @openapi
 * /api/offerings/{offeringId}/groups/{groupId}/enroll/{studentId}:
 *   delete:
 *     tags: [Offerings]
 *     summary: Unenroll student from group
 *     description: Soft-delete an enrollment by setting status to inactive. Requires manage_offerings permission.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offeringId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The offering ID
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The group ID
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The student ID to unenroll
 *     responses:
 *       200:
 *         description: Student unenrolled successfully
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
 *         description: Unauthorized — offering does not belong to teacher
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
router.delete('/:offeringId/groups/:groupId/enroll/:studentId', authenticateToken, requirePermission('manage_offerings'), async (req, res) => {
    try {
        const { offeringId, groupId, studentId } = req.params;

        const { data: offering } = await supabase
            .from('offerings')
            .select('id')
            .eq('id', offeringId)
            .eq('teacher_id', req.user.id)
            .single();

        if (!offering) return res.status(403).json({ success: false, message: 'Unauthorized' });

        const { error } = await supabase
            .from('enrollments')
            .update({ status: 'inactive' })
            .eq('student_id', studentId)
            .eq('group_id', groupId);

        if (error) throw error;
        res.json({ success: true, message: 'Student unenrolled successfully' });
    } catch (error) {
        logger.error('Unenroll student error', { error: error.message });
        res.status(500).json({ success: false, message: 'Failed to unenroll student' });
    }
});

module.exports = router;
