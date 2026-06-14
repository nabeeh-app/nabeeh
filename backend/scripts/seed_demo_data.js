const { supabaseAdmin } = require('../config/database');
const logger = require('../lib/logger');

const DEMO_STUDENTS = [
  { name: 'Ahmed Mohamed Ali', student_code: 'DEMO-001', phone: '+201012345678' },
  { name: 'Fatma Hassan Ibrahim', student_code: 'DEMO-002', phone: '+201023456789' },
  { name: 'Omar Khalid Said', student_code: 'DEMO-003', phone: '+201034567890' },
  { name: 'Nour El-Din Mostafa', student_code: 'DEMO-004', phone: '+201045678901' },
  { name: 'Yasmin Abdel-Rahman', student_code: 'DEMO-005', phone: '+201056789012' },
  { name: 'Khaled Mahmoud Farouk', student_code: 'DEMO-006', phone: '+201067890123' },
  { name: 'Salma Adel Mansour', student_code: 'DEMO-007', phone: '+201078901234' },
  { name: 'Mohamed Ashraf Nagy', student_code: 'DEMO-008', phone: '+201089012345' },
  { name: 'Hana Youssef Kamal', student_code: 'DEMO-009', phone: '+201090123456' },
  { name: 'Tarek Samir Hossam', student_code: 'DEMO-010', phone: '+201101234567' },
  { name: 'Layla Hussein Ali', student_code: 'DEMO-011', phone: '+201112345678' },
  { name: 'Amr Nabil Said', student_code: 'DEMO-012', phone: '+201123456789' },
  { name: 'Mona Fathi Youssef', student_code: 'DEMO-013', phone: '+201134567890' },
  { name: 'Hassan Ibrahim Mohamed', student_code: 'DEMO-014', phone: '+201145678901' },
  { name: 'Dina Karim Abdel-Fattah', student_code: 'DEMO-015', phone: '+201156789012' }
];

const DEMO_PARENTS = [
  { name: 'Mohamed Ali (Father)', phone: '+201012345679', relationship: 'father' },
  { name: 'Hassan Ibrahim (Father)', phone: '+201023456780', relationship: 'father' },
  { name: 'Khalid Said (Father)', phone: '+201034567891', relationship: 'father' },
  { name: 'Mostafa El-Din (Father)', phone: '+201045678902', relationship: 'father' },
  { name: 'Abdel-Rahman Youssef (Father)', phone: '+201056789013', relationship: 'father' },
  { name: 'Mahmoud Farouk (Father)', phone: '+201067890124', relationship: 'father' },
  { name: 'Adel Mansour (Father)', phone: '+201078901235', relationship: 'father' },
  { name: 'Ashraf Nagy (Father)', phone: '+201089012346', relationship: 'father' },
  { name: 'Youssef Kamal (Father)', phone: '+201090123457', relationship: 'father' },
  { name: 'Samir Hossam (Father)', phone: '+201101234568', relationship: 'father' },
  { name: 'Hussein Ali (Father)', phone: '+201112345679', relationship: 'father' },
  { name: 'Nabil Said (Father)', phone: '+201123456780', relationship: 'father' },
  { name: 'Fathi Youssef (Father)', phone: '+201134567891', relationship: 'father' },
  { name: 'Ibrahim Mohamed (Father)', phone: '+201145678902', relationship: 'father' },
  { name: 'Karim Abdel-Fattah (Father)', phone: '+201156789013', relationship: 'father' }
];

const DEMO_GROUPS = [
  { name: 'Mathematics - Grade 10', schedule: 'Saturday, Monday, Wednesday 4:00-6:00 PM' },
  { name: 'Physics - Grade 11', schedule: 'Sunday, Tuesday, Thursday 5:00-7:00 PM' },
  { name: 'Arabic Language - Grade 9', schedule: 'Saturday, Wednesday 3:00-5:00 PM' }
];

const DEMO_ASSESSMENTS = [
  { name: 'Quiz 1', type: 'quiz', max_score: 20 },
  { name: 'Midterm Exam', type: 'midterm', max_score: 50 },
  { name: 'Homework 1', type: 'homework', max_score: 10 },
  { name: 'Final Exam', type: 'final', max_score: 100 }
];

function randomStatus() {
  const r = Math.random();
  if (r < 0.7) return 'present';
  if (r < 0.85) return 'late';
  if (r < 0.95) return 'absent';
  return 'excused';
}

function randomScore(maxScore) {
  const min = Math.floor(maxScore * 0.3);
  return Math.floor(Math.random() * (maxScore - min)) + min;
}

async function seedDemoData(teacherId) {
  logger.info('Seeding demo data', { teacherId });

  try {
    const { data: existingStudents } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('is_demo', true)
      .limit(1);

    if (existingStudents && existingStudents.length > 0) {
      logger.info('Demo data already exists for teacher', { teacherId });
      return { success: true, message: 'Demo data already loaded' };
    }

    const { data: offerings } = await supabaseAdmin
      .from('offerings')
      .select('id')
      .eq('teacher_id', teacherId)
      .limit(1);

    let offeringId;
    if (!offerings || offerings.length === 0) {
      const { data: newOffering } = await supabaseAdmin
        .from('offerings')
        .insert([{
          teacher_id: teacherId,
          subject_id: (await supabaseAdmin.from('subjects').select('id').limit(1)).data?.[0]?.id,
          grade_level_id: (await supabaseAdmin.from('grade_levels').select('id').limit(1)).data?.[0]?.id,
          academic_year: '2025-2026',
          is_demo: true
        }])
        .select()
        .single();
      offeringId = newOffering?.id;
    } else {
      offeringId = offerings[0].id;
    }

    if (!offeringId) {
      logger.error('Cannot seed demo data: no offering available', { teacherId });
      return { success: false, message: 'No offering available for demo data' };
    }

    const groupIds = [];
    for (const group of DEMO_GROUPS) {
      const { data: newGroup } = await supabaseAdmin
        .from('groups')
        .insert([{
          offering_id: offeringId,
          name: group.name,
          schedule_description: group.schedule,
          max_capacity: 30,
          is_demo: true
        }])
        .select()
        .single();
      if (newGroup) groupIds.push(newGroup.id);
    }

    const studentIds = [];
    for (let i = 0; i < DEMO_STUDENTS.length; i++) {
      const demoStudent = DEMO_STUDENTS[i];
      const { data: student } = await supabaseAdmin
        .from('students')
        .insert([{
          teacher_id: teacherId,
          name: demoStudent.name,
          student_code: demoStudent.student_code,
          phone: demoStudent.phone,
          is_demo: true
        }])
        .select()
        .single();

      if (student) {
        studentIds.push(student.id);
        const groupId = groupIds[i % groupIds.length];
        await supabaseAdmin.from('enrollments').insert([{
          student_id: student.id,
          group_id: groupId,
          teacher_id: teacherId,
          status: 'active',
          is_demo: true
        }]);

        const parent = DEMO_PARENTS[i];
        await supabaseAdmin.from('parents').insert([{
          student_id: student.id,
          name: parent.name,
          phone: parent.phone,
          relationship: parent.relationship,
          is_primary: true,
          preferred_language: 'ar',
          is_demo: true
        }]);
      }
    }

    for (const groupId of groupIds) {
      const { data: enrollments } = await supabaseAdmin
        .from('enrollments')
        .select('id')
        .eq('group_id', groupId)
        .eq('is_demo', true);

      if (!enrollments || enrollments.length === 0) continue;

      for (const assessment of DEMO_ASSESSMENTS) {
        const { data: assessmentRecord } = await supabaseAdmin
          .from('assessments')
          .insert([{
            group_id: groupId,
            name: assessment.name,
            type: assessment.type,
            max_score: assessment.max_score,
            date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            is_demo: true
          }])
          .select()
          .single();

        if (assessmentRecord) {
          for (const enrollment of enrollments) {
            await supabaseAdmin.from('grades').insert([{
              enrollment_id: enrollment.id,
              assessment_id: assessmentRecord.id,
              score: randomScore(assessment.max_score),
              is_demo: true
            }]);
          }
        }
      }

      for (let dayOffset = 0; dayOffset < 10; dayOffset++) {
        const sessionDate = new Date(Date.now() - dayOffset * 3 * 24 * 60 * 60 * 1000);
        const { data: session } = await supabaseAdmin
          .from('sessions')
          .insert([{
            group_id: groupId,
            date: sessionDate.toISOString().split('T')[0],
            is_demo: true
          }])
          .select()
          .single();

        if (session) {
          for (const enrollment of enrollments) {
            await supabaseAdmin.from('attendance').insert([{
              enrollment_id: enrollment.id,
              session_id: session.id,
              status: randomStatus(),
              is_demo: true
            }]);
          }
        }
      }
    }

    logger.info('Demo data seeded successfully', { teacherId, students: studentIds.length });
    return { success: true, message: `Demo data loaded: ${studentIds.length} students, ${groupIds.length} groups` };
  } catch (error) {
    logger.error('Failed to seed demo data', { error: error.message, teacherId });
    return { success: false, message: 'Failed to load demo data' };
  }
}

async function removeDemoData(teacherId) {
  logger.info('Removing demo data', { teacherId });

  try {
    const { data: demoStudents } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('is_demo', true);

    if (!demoStudents || demoStudents.length === 0) {
      return { success: true, message: 'No demo data to remove' };
    }

    const studentIds = demoStudents.map(s => s.id);

    const { data: demoEnrollments } = await supabaseAdmin
      .from('enrollments')
      .select('id')
      .in('student_id', studentIds)
      .eq('is_demo', true);

    const enrollmentIds = demoEnrollments?.map(e => e.id) || [];

    if (enrollmentIds.length > 0) {
      await supabaseAdmin.from('grades').delete().in('enrollment_id', enrollmentIds).eq('is_demo', true);
      await supabaseAdmin.from('attendance').delete().in('enrollment_id', enrollmentIds).eq('is_demo', true);
    }

    await supabaseAdmin.from('enrollments').delete().in('student_id', studentIds).eq('is_demo', true);
    await supabaseAdmin.from('parents').delete().in('student_id', studentIds).eq('is_demo', true);
    await supabaseAdmin.from('students').delete().in('id', studentIds).eq('is_demo', true);

    const { data: demoOfferings } = await supabaseAdmin
      .from('offerings')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('is_demo', true);

    if (demoOfferings && demoOfferings.length > 0) {
      const offeringIds = demoOfferings.map(o => o.id);

      const { data: demoGroups } = await supabaseAdmin
        .from('groups')
        .select('id')
        .in('offering_id', offeringIds)
        .eq('is_demo', true);

      if (demoGroups && demoGroups.length > 0) {
        const groupIds = demoGroups.map(g => g.id);
        await supabaseAdmin.from('sessions').delete().in('group_id', groupIds).eq('is_demo', true);
        await supabaseAdmin.from('assessments').delete().in('group_id', groupIds).eq('is_demo', true);
        await supabaseAdmin.from('groups').delete().in('id', groupIds).eq('is_demo', true);
      }

      await supabaseAdmin.from('offerings').delete().in('id', offeringIds).eq('is_demo', true);
    }

    logger.info('Demo data removed', { teacherId });
    return { success: true, message: 'Demo data removed' };
  } catch (error) {
    logger.error('Failed to remove demo data', { error: error.message, teacherId });
    return { success: false, message: 'Failed to remove demo data' };
  }
}

module.exports = { seedDemoData, removeDemoData };

if (require.main === module) {
  const teacherId = process.argv[2];
  if (!teacherId) {
    console.error('Usage: node seed_demo_data.js <teacher_id>');
    process.exit(1);
  }
  seedDemoData(teacherId).then(result => {
    console.log(result);
    process.exit(result.success ? 0 : 1);
  });
}
