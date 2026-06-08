const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { AuthService } = require('../lib/auth');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const authService = new AuthService();

async function createAdmin(email, password, name) {
  const normalizedEmail = email.toLowerCase().trim();

  const passwordValidation = authService.passwordService.validatePasswordStrength(password);
  if (!passwordValidation.isValid) {
    throw new Error(passwordValidation.errors.join(', '));
  }

  const hashedPassword = await authService.passwordService.hashPassword(password);

  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: normalizedEmail,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      role: 'admin'
    }
  });

  if (authError) {
    throw authError;
  }

  const userId = authUser.user.id;

  const { error: teacherError } = await supabase
    .from('teachers')
    .insert({
      id: userId,
      email: normalizedEmail,
      name,
      password_hash: hashedPassword,
      role: 'admin',
      preferred_language: 'en',
      is_active: true
    });

  if (teacherError) {
    await supabase.auth.admin.deleteUser(userId);
    throw teacherError;
  }

  console.log(`✅ Admin account created for ${normalizedEmail}`);
}

async function main() {
  const [email, password, name] = process.argv.slice(2);

  if (!email || !password || !name) {
    console.error('Usage: node scripts/create_admin.js <email> <password> <name>');
    process.exit(1);
  }

  try {
    await createAdmin(email, password, name);
    process.exit(0);
  } catch (error) {
    console.error('Failed to create admin:', error.message || error);
    process.exit(1);
  }
}

main();
