require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixAuth() {
    console.log('Fixing auth...');

    // 1. Hash password
    const password = 'password123';
    const hash = await bcrypt.hash(password, 12);

    // 2. Fetch subjects to assign correct subject_id
    const { data: subjects, error: subjError } = await supabase.from('subjects').select('*');
    if (subjError) {
        console.error('Error fetching subjects:', subjError);
        return;
    }

    const math = subjects.find(s => s.name_en === 'Mathematics' || s.code === 'MATH101');
    const physics = subjects.find(s => s.name_en === 'Physics' || s.code === 'PHYS101'); // Adjust matching logic if needed

    console.log('Found subjects:', { math: math?.id, physics: physics?.id });

    // 3. Update teachers
    const { data: teachers, error: tError } = await supabase.from('teachers').select('*');
    if (tError) {
        console.error('Error fetching teachers:', tError);
        return;
    }

    for (const teacher of teachers) {
        let subject_id = null;
        if (teacher.email.includes('math')) subject_id = math?.id;
        if (teacher.email.includes('physics')) subject_id = physics?.id;

        const { error: updateError } = await supabase
            .from('teachers')
            .update({
                password_hash: hash,
                role: 'teacher',
                subject_id: subject_id,
                is_active: true,
                preferred_language: 'ar'
            })
            .eq('id', teacher.id);

        if (updateError) console.error(`Failed to update ${teacher.email}:`, updateError);
        else console.log(`Updated ${teacher.email} with subject ${subject_id}`);
    }

    console.log('Done.');
}

fixAuth();
