const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
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
                subject:subjects(name_en, name_ar, code),
                grade_level:grade_levels(name, order),
                groups:groups(id, name, schedule_description)
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

// Create a new group for an offering
router.post('/:offeringId/groups', authenticateToken, async (req, res) => {
    try {
        const { name, schedule_description } = req.body;
        const { offeringId } = req.params;

        // Verify ownership
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
                schedule_description
            })
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data: group });
    } catch (error) {
        logger.error('Create group error', { error: error.message });
        res.status(500).json({ success: false, message: 'Failed to create group' });
    }
});

module.exports = router;
