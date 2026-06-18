/**
 * Real concurrent WhatsApp pairing test — 2+ phones simultaneously.
 *
 * Usage:
 *   node test-concurrent-pairing.js <phone1> <phone2> [teacher1] [teacher2]
 *
 * Example:
 *   node test-concurrent-pairing.js 201098455410 201098455411
 *
 * This script:
 * 1. Creates two BaileysClient instances (one per teacher)
 * 2. Connects both simultaneously
 * 3. Generates pairing codes for both
 * 4. Waits for both to connect (515 reconnect flow)
 * 5. Sends test messages from each
 * 6. Verifies sessions are isolated
 * 7. Disconnects and cleans up
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PHONE1 = process.argv[2] || '201098455410';
const PHONE2 = process.argv[3] || '201098455411';
const TEACHER1 = process.argv[4] || '0b8d8f5e-8053-4229-9435-261ef9f12ade';
const TEACHER2 = process.argv[5] || '6e4d2e23-5f78-4f3a-b8c9-1234567890ab';
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
  console.log('✅ DB cleaned for all teachers');
}

async function checkDB() {
  for (const t of TEACHERS) {
    const s = await supabaseAdmin.from('whatsapp_sessions').select('teacher_id,status,phone').eq('teacher_id', t.id);
    const k = await supabaseAdmin.from('whatsapp_auth_keys').select('type,id').eq('teacher_id', t.id);
    const c = await supabaseAdmin.from('whatsapp_auth_creds').select('id,teacher_id').eq('id', t.id);
    console.log(`📊 ${t.label}: sessions=${JSON.stringify(s.data)} keys=${k.data?.length || 0} creds=${c.data?.length || 0}`);
  }
}

async function createClientForTeacher(teacherId) {
  const baileys = await import('@whiskeysockets/baileys');
  const { useSupabaseAuthState } = require('./lib/baileysAuthState');

  const { state, saveCreds, flushPendingSave, cancelPendingSave } = await useSupabaseAuthState(teacherId);
  const { version } = await baileys.fetchLatestBaileysVersion();

  const sock = baileys.makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: baileys.makeCacheableSignalKeyStore(state.keys, { info: () => {}, error: () => {}, warn: () => {}, debug: () => {}, trace: () => {}, fatal: () => {} })
    },
    printQRInTerminal: false,
    browser: ['Windows', 'Chrome', '114.0.5735.198'],
    getMessage: async () => undefined
  });

  sock.ev.on('creds.update', saveCreds);

  return { sock, flushPendingSave, cancelPendingSave, baileys };
}

function waitForConnection(sock, baileys, label, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label}: Timeout waiting for connection`));
    }, timeoutMs);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`📱 ${label}: QR code received (pairing code mode recommended)`);
      }

      if (connection === 'open') {
        clearTimeout(timer);
        console.log(`✅ ${label}: CONNECTED as ${sock.user?.id}`);
        resolve(sock.user?.id);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        if (statusCode === baileys.DisconnectReason.restartRequired) {
          console.log(`🔄 ${label}: 515 restart required, will auto-reconnect`);
        } else if (statusCode === baileys.DisconnectReason.loggedOut) {
          clearTimeout(timer);
          reject(new Error(`${label}: Logged out`));
        }
      }
    });
  });
}

async function main() {
  console.log('🚀 Starting concurrent WhatsApp pairing test');
  console.log(`📞 Phone 1: +${PHONE1} (Teacher: ${TEACHER1})`);
  console.log(`📞 Phone 2: +${PHONE2} (Teacher: ${TEACHER2})`);

  await cleanupDB();

  const clients = [];

  // Step 1: Create and connect both clients simultaneously
  console.log('\n📡 Step 1: Connecting both clients simultaneously...');
  const connectPromises = TEACHERS.map(async (t) => {
    try {
      const client = await createClientForTeacher(t.id);
      clients.push({ ...client, ...t });
      return client;
    } catch (err) {
      console.error(`❌ ${t.label}: Connect failed: ${err.message}`);
      throw err;
    }
  });

  const connectResults = await Promise.allSettled(connectPromises);
  const successful = connectResults.filter(r => r.status === 'fulfilled').length;
  console.log(`📊 Connected: ${successful}/${TEACHERS.length}`);

  if (successful === 0) {
    console.error('❌ No clients connected, aborting');
    process.exit(1);
  }

  // Step 2: Request pairing codes for all connected clients
  console.log('\n📱 Step 2: Requesting pairing codes...');
  const pairingCodes = [];

  for (const client of clients) {
    try {
      const waitForQR = new Promise((resolve) => {
        const handler = (update) => {
          if (update.qr) {
            client.sock.ev.off('connection.update', handler);
            resolve();
          }
        };
        client.sock.ev.on('connection.update', handler);
        setTimeout(resolve, 10000);
      });

      await waitForQR;

      const code = await client.sock.requestPairingCode(client.phone);
      const formatted = `${code.slice(0, 4)}-${code.slice(4)}`;
      console.log(`🔑 ${client.label}: Pairing code = ${formatted} (enter on phone +${client.phone})`);
      pairingCodes.push({ label: client.label, code: formatted, phone: client.phone });
    } catch (err) {
      console.error(`❌ ${client.label}: Pairing code failed: ${err.message}`);
    }
  }

  // Step 3: Wait for all clients to connect
  console.log('\n⏳ Step 3: Waiting for all phones to connect (enter codes now)...');
  const connectionPromises = clients.map((client) =>
    waitForConnection(client.sock, client.baileys, client.label).catch(err => {
      console.error(`❌ ${client.label}: ${err.message}`);
      return null;
    })
  );

  const connections = await Promise.allSettled(connectionPromises);
  const connected = connections.filter(r => r.status === 'fulfilled' && r.value !== null).length;
  console.log(`📊 Connected sessions: ${connected}/${clients.length}`);

  if (connected === 0) {
    console.error('❌ No sessions connected');
    await cleanupDB();
    process.exit(1);
  }

  // Step 4: Verify isolation - each client has different user ID
  console.log('\n🔒 Step 4: Verifying session isolation...');
  const userIds = new Set();
  for (const client of clients) {
    const userId = client.sock.user?.id;
    if (userId) {
      userIds.add(userId);
      console.log(`👤 ${client.label}: user = ${userId}`);
    }
  }
  if (userIds.size === connected) {
    console.log('✅ Session isolation confirmed — all user IDs are unique');
  } else {
    console.error('❌ Session isolation FAILED — duplicate user IDs detected');
  }

  // Step 5: Send test messages (one per session)
  console.log('\n📤 Step 5: Sending test messages...');
  for (const client of clients) {
    try {
      if (!client.sock.user) continue;
      const jid = `${client.phone}@s.whatsapp.net`;
      await client.sock.sendMessage(jid, { text: `[Nabeeh Test] ${client.label} concurrent session test - ${new Date().toISOString()}` });
      console.log(`✅ ${client.label}: Test message sent`);
    } catch (err) {
      console.error(`❌ ${client.label}: Send failed: ${err.message}`);
    }
  }

  // Step 6: Verify DB state
  console.log('\n📊 Step 6: Checking DB state...');
  await checkDB();

  // Step 7: Memory usage
  const mem = process.memoryUsage();
  console.log(`\n💾 Memory: RSS=${Math.round(mem.rss / 1024 / 1024)}MB Heap=${Math.round(mem.heapUsed / 1024 / 1024)}/${Math.round(mem.heapTotal / 1024 / 1024)}MB`);

  // Step 8: Graceful shutdown
  console.log('\n🔌 Step 8: Disconnecting all sessions...');
  for (const client of clients) {
    try {
      await client.flushPendingSave();
      await client.sock.logout();
      console.log(`✅ ${client.label}: Logged out`);
    } catch (err) {
      console.warn(`⚠️ ${client.label}: Logout warning: ${err.message}`);
    }
  }

  await checkDB();
  console.log('\n✅ Concurrent pairing test complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
