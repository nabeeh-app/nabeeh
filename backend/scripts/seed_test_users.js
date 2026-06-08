const { createClient } = require('@supabase/supabase-js');
const { PasswordService } = require('../lib/auth');
require('dotenv').config();

// Initialize Supabase with Service Role Key for Admin access (creating auth users)
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

const passwordService = new PasswordService();

async function seedTestUsers() {
    try {
        console.log('🌱 Starting database seeding (Normalized Schema)...');

        // 1. Static Data: Grade Levels
        console.log('📚 Creating Grade Levels...');
        const gradeLevelsData = [
            { name: '1st Secondary', order: 10 },
            { name: '2nd Secondary', order: 11 },
            { name: '3rd Secondary', order: 12 }
        ];

        // Upsert grades
        const { data: grades, error: gradesError } = await supabase
            .from('grade_levels')
            .upsert(gradeLevelsData, { onConflict: 'name' })
            .select();

        if (gradesError) throw gradesError;
        console.log(`  ✅ Created ${grades.length} grade levels`);

        // 2. Static Data: Subjects
        console.log('📚 Creating Subjects...');
        const subjectsData = [
            { code: 'MATH', name_en: 'Mathematics', name_ar: 'الرياضيات' },
            { code: 'PHYS', name_en: 'Physics', name_ar: 'الفيزياء' },
            { code: 'ARAB', name_en: 'Arabic', name_ar: 'اللغة العربية' },
            { code: 'ENG', name_en: 'English', name_ar: 'اللغة الانجليزية' }
        ];

        const { data: subjects, error: subjectsError } = await supabase
            .from('subjects')
            .upsert(subjectsData, { onConflict: 'code' })
            .select();

        if (subjectsError) throw subjectsError;
        console.log(`  ✅ Created ${subjects.length} subjects`);

        // Map for easy lookup
        const subjectMap = {};
        subjects.forEach(s => subjectMap[s.code] = s.id);
        const gradeMap = {};
        grades.forEach(g => gradeMap[g.name] = g.id);


        // 3. Teachers (and Auth Users)
        console.log('👤 Creating Teachers & Auth Accounts...');
        const teachersData = [
            {
                email: 'teacher.math@nabeeh.com',
                name: 'Ahmed Hassan',
                subject_code: 'MATH',
                password: 'Teacher123!'
            },
            {
                email: 'teacher.physics@nabeeh.com',
                name: 'Sarah Johnson',
                subject_code: 'PHYS',
                password: 'Teacher123!'
            }
        ];

        for (const t of teachersData) {
            // A. Create/Get Auth User
            let userId;
            const { data: existingUsers } = await supabase.auth.admin.listUsers();
            const existingUser = existingUsers.users.find(u => u.email === t.email);

            if (existingUser) {
                userId = existingUser.id;
                await supabase.auth.admin.updateUserById(userId, { password: t.password });
                console.log(`  ⚠️ User ${t.email} exists, updated password.`);
            } else {
                const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                    email: t.email,
                    password: t.password,
                    email_confirm: true,
                    user_metadata: { name: t.name }
                });
                if (createError) throw createError;
                userId = newUser.user.id;
                console.log(`  ✅ Created Auth User: ${t.email}`);
            }

            // B. Create Teacher Profile (references auth.users)
            const { error: teacherError } = await supabase
                .from('teachers')
                .upsert({
                    id: userId,
                    name: t.name,
                    email: t.email
                })
                .select();

            if (teacherError) throw teacherError;

            // C. Link Subject
            if (t.subject_code && subjectMap[t.subject_code]) {
                await supabase.from('teacher_subjects').upsert({
                    teacher_id: userId,
                    subject_id: subjectMap[t.subject_code]
                });
            }

            // D. Create Offerings
            console.log(`  📝 Creating Offerings for ${t.name}...`);
            const targetGrades = ['1st Secondary', '2nd Secondary'];

            for (const gradeName of targetGrades) {
                const gradeId = gradeMap[gradeName];
                if (!gradeId) continue;

                const { data: offering, error: offError } = await supabase
                    .from('offerings')
                    .upsert({
                        teacher_id: userId,
                        subject_id: subjectMap[t.subject_code],
                        grade_level_id: gradeId,
                        academic_year: '2025-2026',
                        is_active: true
                    }, { onConflict: 'teacher_id,subject_id,grade_level_id,academic_year' })
                    .select()
                    .single();

                if (offError) throw offError;

                // E. Create Groups
                const groupNames = ['Group A', 'Group B'];
                for (const gName of groupNames) {
                    const { data: group, error: grpError } = await supabase
                        .from('groups')
                        .insert({
                            offering_id: offering.id,
                            name: gName,
                            schedule_description: 'Sun/Tue 10:00 AM'
                        })
                        .select()
                        .single();

                    if (!grpError && gName === 'Group A') {
                        await seedStudentsForGroup(group.id, gradeName, t);
                    }
                }
            }
        }

        console.log('\n🎉 Database seeding completed successfully!');

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
}

async function seedStudentsForGroup(groupId, gradeName, teacher) {
    const studentsData = [
        { name: `Student ${gradeName} 1`, phone: '+20100000001' },
        { name: `Student ${gradeName} 2`, phone: '+20100000002' }
    ];

    for (const s of studentsData) {
        const studentCode = `ST-${Math.floor(Math.random() * 100000)}`;

        // Create Student
        const { data: student, error: stError } = await supabase
            .from('students')
            .insert({
                name: s.name,
                phone: s.phone,
                student_code: studentCode
            })
            .select()
            .single();

        if (stError) {
            console.log('  ⚠️ Student creation failed (duplicate?):', stError.message);
            continue;
        }

        // Enroll
        await supabase
            .from('enrollments')
            .insert({
                student_id: student.id,
                group_id: groupId,
                status: 'active'
            });

        // Create Parent
        await supabase
            .from('parents')
            .insert({
                student_id: student.id,
                name: `Parent of ${s.name}`,
                phone: s.phone,
                relationship: 'father',
                is_primary: true
            });
    }
}

if (require.main === module) {
    seedTestUsers();
}

module.exports = { seedTestUsers };