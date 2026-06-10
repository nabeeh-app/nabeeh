const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validate, createOfferingSchema, createGroupSchema, updateGroupSchema } = require('../middleware/validate');
const logger = require('../lib/logger');

// Get all offerings for the logged-in teacher
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
                groups:groups(id, name, max_capacity, schedule_description, is_active)
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

// Get single offering with groups and enrollments
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
                    id, name, max_capacity, schedule_description, is_active,
                    enrollments(
                        id,
                        student:students(id, name, student_code, phone),
                        enrolled_at,
                        is_active
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

// Create a new offering
router.post('/', authenticateToken, validate(createOfferingSchema), async (req, res) => {
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

// Delete an offering (soft delete - set is_active to false)
router.delete('/:id', authenticateToken, async (req, res) => {
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

// Get groups for an offering
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
                id, name, max_capacity, schedule_description, is_active,
                enrollments(
                    id,
                    student:students(id, name, student_code),
                    enrolled_at,
                    is_active
                )
            `)
            .eq('offering_id', req.params.offeringId)
            .order('name');

        if (error) throw error;

        const groupsWithCounts = groups.map(g => ({
            ...g,
            enrolled_count: g.enrollments?.filter(e => e.is_active).length || 0
        }));

        res.json({ success: true, data: groupsWithCounts });
    } catch (error) {
        logger.error('Get groups error', { error: error.message });
        res.status(500).json({ success: false, message: 'Failed to fetch groups' });
    }
});

// Create a new group for an offering
router.post('/:offeringId/groups', authenticateToken, validate(createGroupSchema), async (req, res) => {
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

// Update a group
router.put('/:offeringId/groups/:groupId', authenticateToken, validate(updateGroupSchema), async (req, res) => {
    try {
        const { offeringId, groupId } = req.params;

        const { data: offering } = await supabase
            .from('offerings')
            .select('id')
            .eq('id', offeringId)
            .eq('teacher_id', req.user.id)
            .single();

        if (!offering) return res.status(403).json({ success: false, message: 'Unauthorized' });

        const { data: group, error } = await supabase
            .from('groups')
            .update(req.body)
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

// Enroll a student in a group
router.post('/:offeringId/groups/:groupId/enroll', authenticateToken, async (req, res) => {
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
                .eq('is_active', true);

            if (count >= group.max_capacity) {
                return res.status(400).json({ success: false, message: 'Group is at full capacity' });
            }
        }

        // Check if already enrolled
        const { data: existing } = await supabase
            .from('enrollments')
            .select('id, is_active')
            .eq('student_id', student_id)
            .eq('group_id', groupId)
            .single();

        if (existing && existing.is_active) {
            return res.status(409).json({ success: false, message: 'Student is already enrolled in this group' });
        }

        // Re-enroll if previously withdrawn, or create new
        let enrollment;
        if (existing) {
            const { data, error } = await supabase
                .from('enrollments')
                .update({ is_active: true, enrolled_at: new Date().toISOString() })
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

// Unenroll a student from a group (soft delete)
router.delete('/:offeringId/groups/:groupId/enroll/:studentId', authenticateToken, async (req, res) => {
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
            .update({ is_active: false })
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
