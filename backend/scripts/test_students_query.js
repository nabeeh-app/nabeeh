const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testQuery() {
    console.log('Testing getStudents query...');

    // 1. Get a teacher ID
    const { data: teacher } = await supabase.from('teachers').select('id, email').limit(1).single();
    if (!teacher) {
        console.error('No teacher found');
        return;
    }
    console.log('Using teacher:', teacher.email, teacher.id);

    // 2. Run the query
    try {
        const { data, error } = await supabase
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
            .eq('enrollments.group.offering.teacher_id', teacher.id)
            .limit(5);

        if (error) {
            console.error('Query Error:', error);
        } else {
            console.log('Query Success. Count:', data.length);
            if (data.length > 0) console.log('First student:', data[0].name);
        }

    } catch (err) {
        console.error('Execution Error:', err);
    }
}

testQuery();
