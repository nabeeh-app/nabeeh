const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testGradesQuery() {
    console.log('Testing getGrades query...');

    // 1. Get a teacher ID
    const { data: teacher } = await supabase.from('teachers').select('id, email').limit(1).single();
    if (!teacher) {
        console.error('No teacher found');
        return;
    }
    console.log('Using teacher:', teacher.email, teacher.id);

    // 2. Run the query being used in grades.js
    try {
        const { data, error } = await supabase
            .from('grades')
            .select(`
                id,
                score,
                assessment:assessments!inner (
                    id,
                    title,
                    total_marks,
                    date,
                    offering:offerings!inner (
                        teacher_id,
                        subject:subjects (name_en, name_ar, code)
                    )
                ),
                enrollment:enrollments!inner (
                    student:students (
                        id,
                        name,
                        student_id
                    )
                )
            `)
            .eq('assessments.offerings.teacher_id', teacher.id)
            .limit(5);

        if (error) {
            console.error('Query Error:', error);
        } else {
            console.log('Query Success. Count:', data?.length);
            if (data?.length > 0) console.log('Sample:', JSON.stringify(data[0], null, 2));
        }

    } catch (err) {
        console.error('Execution Error:', err);
    }
}

testGradesQuery();
