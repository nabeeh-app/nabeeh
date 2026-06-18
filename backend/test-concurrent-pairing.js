/**
 * Real concurrent WhatsApp pairing test — 2 phones simultaneously.
 *
 * Uses BaileysClient (handles 515 reconnect internally).
 *
 * Usage:
 *   node test-concurrent-pairing.js <phone1> <phone2> [teacher1] [teacher2]
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const { BaileysClient } = require('./lib/baileys');
const sessionManager = require('./lib/sessionManager');
const { supabaseAdmin } = require('./config/database');

const PHONE1 = process.argv[2] || '201211310357';
const PHONE2 = process.argv[3] || '201098455410';
const TEACHER1 = process.argv[4] || '0b8d8f5e-8053-4229-9435-261ef9f12ade';
const TEACHER2 = process.argv[5] || '6e4d2e23-7cf9-4a82-9335-33c835728b89';

const TEACHERS = [
  { id: TEACHER1, phone: PHONE1, label: 'T1' },
  { id: TEACHER2, phone: PHONE2, label: 'T2' }
];

async function cleanupDB() {
  for (const t of TEACHERS) {
    console.log(`🧹 Cleaning DB for ${t.label} (${t.id})`);
    await supabaseAdmin.from('whatsapp_auth_keys').delete().eq('teacher_id', t.id);
    await supabaseAdmin.from('whatsapp_auth_creds').delete().eq('id', t.id);
    await supabaseAdmin.from('whatsapp_sessions').delete().eq('teacher_id', t.id);
  }
  console.log('✅ DB cleaned');
}

async function checkDB() {
  for (const t of TEACHERS) {
    const s = await supabaseAdmin.from('whatsapp_sessions').select('teacher_id,status,phone').eq('teacher_id', t.id);
    const k = await supabaseAdmin.from('whatsapp_auth_keys').select('type,id').eq('teacher_id', t.id);
    const c = await supabaseAdmin.from('whatsapp_auth_creds').select('id').eq('id', t.id);
    console.log(`📊 ${t.label}: session=${JSON.stringify(s.data)} keys=${k.data?.length || 0} creds=${c.data?.length || 0}`);
  }
}

function waitForConnected(client, label, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    if (client.status === 'connected') return resolve(client.connectedPhone);

    const timer = setTimeout(() => {
      client.removeListener('connection.update', handler);
      reject(new Error(`${label}: Timeout (${timeoutMs}ms)`));
    }, timeoutMs);

    const handler = (update) => {
      if (update.status === 'connected') {
        clearTimeout(timer);
        client.removeListener('connection.update', handler);
        console.log(`✅ ${label}: CONNECTED as +${client.connectedPhone}`);
        resolve(client.connectedPhone);
      }
    };

    client.on('connection.update', handler);
  });
}

async function main() {
  console.log('🚀 Concurrent WhatsApp pairing test');
  console.log(`📞 T1: +${PHONE1} → ${TEACHER1}`);
  console.log(`📞 T2: +${PHONE2} → ${TEACHER2}`);

  await cleanupDB();

  // Step 1: Create both BaileysClient instances and connect simultaneously
  console.log('\n📡 Step 1: Connecting both clients...');
  const clients = TEACHERS.map(t => {
    const client = new BaileysClient(t.id);
    return { client, ...t };
  });

  await Promise.all(clients.map(c => c.client.connect().catch(err => {
    console.error(`❌ ${c.label}: Connect error: ${err.message}`);
  })));

  console.log('📊 Both clients initialized');

  // Step 2: Request pairing codes (wait for QR event first)
  console.log('\n📱 Step 2: Requesting pairing codes...');
  for (const c of clients) {
    try {
      await c.client.waitForReady(15000);
      const code = await c.client.requestPairingCode(c.phone);
      const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
      console.log(`🔑 ${c.label}: Pairing code = ${formatted} (enter on phone +${c.phone})`);
    } catch (err) {
      console.error(`❌ ${c.label}: Pairing code failed: ${err.message}`);
    }
  }

  // Step 3: Wait for both to connect (515 reconnect handled by BaileysClient)
  console.log('\n⏳ Step 3: Waiting for phones to connect...');
  const results = await Promise.allSettled(
    clients.map(c => waitForConnected(c.client, c.label))
  );

  const connected = results.filter(r => r.status === 'fulfilled').length;
  console.log(`📊 Connected: ${connected}/${clients.length}`);

  if (connected === 0) {
    console.error('❌ No sessions connected');
    await cleanupDB();
    process.exit(1);
  }

  // Step 4: Verify isolation
  console.log('\n🔒 Step 4: Verifying session isolation...');
  const phones = new Set();
  for (const c of clients) {
    if (c.client.connectedPhone) {
      phones.add(c.client.connectedPhone);
      console.log(`👤 ${c.label}: phone = +${c.client.connectedPhone}`);
    }
  }
  console.log(phones.size === connected
    ? '✅ Session isolation confirmed — unique phones'
    : '❌ DUPLICATE phones detected!');

  // Step 5: Send test messages
  console.log('\n📤 Step 5: Sending test messages...');
  for (const c of clients) {
    if (c.client.status !== 'connected') continue;
    try {
      await c.client.sendMessage(`+${c.phone}`, `[Nabeeh Test] ${c.label} concurrent test - ${new Date().toISOString()}`);
      console.log(`✅ ${c.label}: Message sent`);
    } catch (err) {
      console.error(`❌ ${c.label}: Send failed: ${err.message}`);
    }
  }

  // Step 6: DB check
  console.log('\n📊 Step 6: DB state...');
  await checkDB();

  // Step 7: Memory
  const mem = process.memoryUsage();
  console.log(`\n💾 Memory: RSS=${Math.round(mem.rss / 1024 / 1024)}MB Heap=${Math.round(mem.heapUsed / 1024 / 1024)}/${Math.round(mem.heapTotal / 1024 / 1024)}MB`);

  // Step 8: Disconnect
  console.log('\n🔌 Step 8: Disconnecting...');
  for (const c of clients) {
    try {
      await c.client.logout();
      console.log(`✅ ${c.label}: Logged out`);
    } catch (err) {
      console.warn(`⚠️ ${c.label}: ${err.message}`);
    }
  }

  await checkDB();
  console.log('\n✅ Test complete!');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
