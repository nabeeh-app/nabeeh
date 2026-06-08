const { createClient } = require('@supabase/supabase-js');
const { PasswordService } = require('../lib/auth');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const passwordService = new PasswordService();

async function fixTeacherPasswords() {
    try {
        console.log('🔍 Checking for teachers with missing or plain text passwords...');
        
        // Get all teachers
        const { data: teachers, error } = await supabase
            .from('teachers')
            .select('id, email, name, password_hash')
            .order('created_at');

        if (error) {
            throw error;
        }

        console.log(`📊 Found ${teachers.length} teachers in database`);

        let fixedCount = 0;
        let skippedCount = 0;

        for (const teacher of teachers) {
            // Check if password is null or doesn't look like a bcrypt hash
            const needsHashing = !teacher.password_hash || 
                                !teacher.password_hash.startsWith('$2a$') && 
                                !teacher.password_hash.startsWith('$2b$');

            if (needsHashing) {
                console.log(`🔧 Fixing password for teacher: ${teacher.name} (${teacher.email})`);
                
                // Generate a temporary password if null, or hash existing plain text
                const tempPassword = teacher.password_hash || 'TempPass123!';
                const hashedPassword = await passwordService.hashPassword(tempPassword);
                
                // Update the teacher's password
                const { error: updateError } = await supabase
                    .from('teachers')
                    .update({ password_hash: hashedPassword })
                    .eq('id', teacher.id);

                if (updateError) {
                    console.error(`❌ Failed to update password for ${teacher.email}:`, updateError);
                } else {
                    console.log(`✅ Updated password for ${teacher.email}`);
                    if (!teacher.password_hash) {
                        console.log(`   📝 Generated temporary password: ${tempPassword}`);
                        console.log(`   ⚠️  Teacher should change this password on first login`);
                    }
                    fixedCount++;
                }
            } else {
                console.log(`✓ Password already hashed for: ${teacher.name} (${teacher.email})`);
                skippedCount++;
            }
        }

        console.log('\n📈 Summary:');
        console.log(`   ✅ Fixed passwords: ${fixedCount}`);
        console.log(`   ✓ Already hashed: ${skippedCount}`);
        console.log(`   📊 Total teachers: ${teachers.length}`);

        if (fixedCount > 0) {
            console.log('\n⚠️  Important Notes:');
            console.log('   - Teachers with generated temporary passwords should change them on first login');
            console.log('   - All passwords are now securely hashed with bcrypt (12 salt rounds)');
            console.log('   - The authentication system is ready to use');
        }

    } catch (error) {
        console.error('❌ Error fixing teacher passwords:', error);
        process.exit(1);
    }
}

// Run the script
fixTeacherPasswords();