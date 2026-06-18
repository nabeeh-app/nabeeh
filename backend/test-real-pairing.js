/**
 * Real WhatsApp pairing test — multi-session.
 * Tests: pair via code, connect, send test message, disconnect, verify DB state.
 *
 * Usage: node test-real-pairing.js <phone> [teacherId]
 * Example: node test-real-pairing.js 201211310357
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env') });

const PHONE = process.argv[2] || '201211310357';
const TEACHER_ID = process.argv[3] || '0b8d8f5e-8053-4229-9435-261ef9f12ade';

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Dynamic import for ESM Baileys
async function loadBaileys() {
  const baileys = await import('@whiskeysockets/baileys');
  return baileys;
}

async function cleanupDB() {
  console.log('\n🧹 Cleaning DB for teacher:', TEACHER_ID);
  await supabaseAdmin.from('whatsapp_auth_keys').delete().eq('teacher_id', TEACHER_ID);
  await supabaseAdmin.from('whatsapp_auth_creds').delete().eq('teacher_id', TEACHER_ID);
  await supabaseAdmin.from('whatsapp_sessions').delete().eq('teacher_id', TEACHER_ID);
  console.log('✅ DB cleaned');
}

async function checkDBState(label) {
  console.log(`\n📊 DB State [${label}]:`);

  const { data: sessions } = await supabaseAdmin.from('whatsapp_sessions')
    .select('*').eq('teacher_id', TEACHER_ID);
  console.log('  sessions:', JSON.stringify(sessions, null, 2));

  const { data: keys } = await supabaseAdmin.from('whatsapp_auth_keys')
    .select('type, id').eq('teacher_id', TEACHER_ID);
  console.log('  auth_keys:', keys?.length || 0, 'rows');

  const { data: creds } = await supabaseAdmin.from('whatsapp_auth_creds')
    .select('id, teacher_id').eq('teacher_id', TEACHER_ID);
  console.log('  auth_creds:', creds?.length || 0, 'rows');
}

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  Real WhatsApp Multi-Session Pairing Test    ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Phone:     +${PHONE}`);
  console.log(`║  Teacher:   ${TEACHER_ID}`);
  console.log('╚══════════════════════════════════════════════╝');

  // Step 1: Cleanup
  await cleanupDB();
  await checkDBState('after cleanup');

  // Step 2: Load Baileys
  console.log('\n⏳ Loading Baileys...');
  const {
    makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    initAuthCreds
  } = await loadBaileys();
  console.log('✅ Baileys loaded');

  // Step 3: Use Supabase-backed auth state (simulates real use)
  const { useSupabaseAuthState } = require('./lib/baileysAuthState');
  const { state, saveCreds, flushPendingSave, cancelPendingSave } = await useSupabaseAuthState(TEACHER_ID);

  // Step 4: Connect
  console.log('\n⏳ Connecting to WhatsApp...');
  const { version } = await fetchLatestBaileysVersion();
  console.log('  WA version:', version);

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.creds ? state : { creds: initAuthCreds(), keys: {} }, console)
    },
    printQRInTerminal: false,
    browser: ['Nabeeh', 'Chrome', '20.0.04'],
    logger: { level: 'silent' },
    getMessage: async () => undefined
  });

  let codeSent = false;
  let connected = false;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    console.log('\n[connection.update]', { connection, hasQr: !!qr, statusCode: lastDisconnect?.error?.output?.statusCode });

    if (connection === 'open') {
      connected = true;
      const phone = sock.user?.id?.split(':')[0]?.split('@')[0];
      console.log('\n✅ CONNECTED! Phone:', phone);

      // Write session to DB
      await supabaseAdmin.from('whatsapp_sessions').upsert({
        teacher_id: TEACHER_ID,
        status: 'connected',
        phone: `+${phone}`,
        last_active: new Date().toISOString(),
        connected_at: new Date().toISOString()
      }, { onConflict: 'teacher_id' });

      await flushPendingSave();
      await checkDBState('after connect');

      // Send test message
      console.log('\n⏳ Sending test message...');
      try {
        const jid = `${PHONE}@s.whatsapp.net`;
        await sock.sendMessage(jid, { text: '✅ Multi-session test message from Nabeeh!' });
        console.log('✅ Message sent to', PHONE);
      } catch (err) {
        console.error('❌ Send failed:', err.message);
      }

      // Wait a moment then disconnect
      console.log('\n⏳ Waiting 3s then disconnecting...');
      await new Promise(r => setTimeout(r, 3000));

      console.log('\n⏳ Disconnecting...');
      await sock.end();
      connected = false;

      await checkDBState('after disconnect');
      console.log('\n🎉 TEST COMPLETE');
      process.exit(0);
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log('[close] statusCode:', statusCode);

      if (statusCode === DisconnectReason.loggedOut) {
        console.log('⚠️  Logged out — phone was unlinked');
        await cleanupDB();
        process.exit(1);
      }

      if (statusCode === DisconnectReason.restartRequired) {
        console.log('🔄 Restart required after pairing — reconnecting...');
        // Reconnect automatically
        return;
      }
    }

    if (qr && !codeSent) {
      codeSent = true;
      console.log('\n⏳ QR received, requesting pairing code...');
      try {
        const code = await sock.requestPairingCode(PHONE);
        console.log(`\n🔑 YOUR PAIRING CODE: ${code}`);
        console.log('📱 Enter this on your phone: Settings → Linked Devices → Link with Phone Number\n');
      } catch (err) {
        console.error('❌ requestPairingCode failed:', err.message);
        process.exit(1);
      }
    }
  });

  // Timeout
  setTimeout(async () => {
    console.log('\n⏰ Timeout (120s) — test incomplete');
    if (connected) await sock.end();
    await checkDBState('after timeout');
    process.exit(1);
  }, 120000);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
