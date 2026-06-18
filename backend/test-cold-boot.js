/**
 * Cold boot test: Simulates server restart with 2 persisted sessions.
 * Requires real auth creds in DB for both teachers.
 * 
 * Usage: node test-cold-boot.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const sessionManager = require('./lib/sessionManager');
const { supabaseAdmin } = require('./config/database');

const TEACHER1 = '0b8d8f5e-8053-4229-9435-261ef9f12ade';
const TEACHER2 = '6e4d2e23-7cf9-4a82-9335-33c835728b89';

async function main() {
  console.log('🧊 Cold Boot Test: Simulating server restart\n');

  // Check what's in the DB before starting
  const { data: sessions } = await supabaseAdmin
    .from('whatsapp_sessions')
    .select('teacher_id, status, phone')
    .in('teacher_id', [TEACHER1, TEACHER2]);
  console.log('📊 DB sessions before start:', JSON.stringify(sessions, null, 2));

  const { data: creds } = await supabaseAdmin
    .from('whatsapp_auth_creds')
    .select('id')
    .in('id', [TEACHER1, TEACHER2]);
  console.log('📊 DB creds:', creds?.length || 0, 'entries');

  const { data: keys1 } = await supabaseAdmin
    .from('whatsapp_auth_keys')
    .select('type, id')
    .eq('teacher_id', TEACHER1);
  const { data: keys2 } = await supabaseAdmin
    .from('whatsapp_auth_keys')
    .select('type, id')
    .eq('teacher_id', TEACHER2);
  console.log(`📊 DB keys: T1=${keys1?.length || 0}, T2=${keys2?.length || 0}`);

  if (!creds?.length && (!keys1?.length && !keys2?.length)) {
    console.log('\n⚠️  No auth creds/keys in DB. Sessions will start in QR/pairing mode.');
    console.log('   To test full reconnect, pair phones first with test-concurrent-pairing.js\n');
  }

  // Start session manager (like server.js does on boot)
  console.log('\n🚀 Starting session manager...');
  const startTime = Date.now();

  try {
    await sessionManager.start();
  } catch (err) {
    console.error('❌ Session manager start failed:', err.message);
  }

  const bootTime = Date.now() - startTime;
  console.log(`\n⏱️  Boot time: ${bootTime}ms`);

  // Check what sessions were created
  const status = sessionManager.getStatus();
  console.log(`\n📊 Active sessions: ${status.totalSessions}/${status.maxSessions}`);

  for (const [teacherId, sessionStatus] of Object.entries(status.sessions)) {
    console.log(`  ${teacherId.slice(0, 8)}...: status=${sessionStatus.status} phone=${sessionStatus.phone || 'none'}`);
  }

  // Wait a bit for connections to establish
  console.log('\n⏳ Waiting 15s for sessions to connect...');
  await new Promise(r => setTimeout(r, 15000));

  // Re-check status
  const afterStatus = sessionManager.getStatus();
  console.log(`\n📊 After 15s:`);
  for (const [teacherId, sessionStatus] of Object.entries(afterStatus.sessions)) {
    console.log(`  ${teacherId.slice(0, 8)}...: status=${sessionStatus.status} phone=${sessionStatus.phone || 'none'}`);
  }

  const connected = Object.values(afterStatus.sessions).filter(s => s.status === 'connected').length;
  console.log(`\n✅ Connected sessions: ${connected}/${afterStatus.totalSessions}`);

  // Memory
  const mem = process.memoryUsage();
  console.log(`💾 Memory: RSS=${Math.round(mem.rss / 1024 / 1024)}MB Heap=${Math.round(mem.heapUsed / 1024 / 1024)}/${Math.round(mem.heapTotal / 1024 / 1024)}MB`);

  // Stop
  console.log('\n🛑 Stopping session manager...');
  await sessionManager.stop();
  console.log('✅ Stopped');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
