const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from backend/.env by default
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const migrationsDir = path.join(__dirname, 'migrations');

async function runMigrationFile(fileName) {
  try {
    const filePath = path.join(migrationsDir, fileName);
    const sql = fs.readFileSync(filePath, 'utf8');

    console.log(`\n⏳ Running migration: ${fileName}`);
    const { error } = await supabase.rpc('exec_sql', { sql });

    if (error) {
      console.error(`❌ Migration ${fileName} failed:`, error);
      process.exit(1);
    }

    console.log(`✅ Migration ${fileName} completed`);
  } catch (err) {
    console.error(`❌ Error reading migration ${fileName}:`, err);
    process.exit(1);
  }
}

async function runAllMigrations() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  for (const file of files) {
    await runMigrationFile(file);
  }

  console.log('\n🎉 All migrations executed successfully!');
}

runAllMigrations();
