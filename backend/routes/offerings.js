const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { authenticateToken } = require('../middleware/auth');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
        res.json(offerings);
    } catch (error) {
        res.status(500).json({ error: error.message });
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

        if (!offering) return res.status(403).json({ error: 'Unauthorized' });

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
        res.json(group);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
