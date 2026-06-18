/**
 * Real WhatsApp pairing test — multi-session.
 *
 * Usage: node test-real-pairing.js <phone> [teacherId]
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PHONE = process.argv[2] || '201098455410';
const TEACHER_ID = process.argv[3] || '0b8d8f5e-8053-4229-9435-261ef9f12ade';
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanupDB() {
  console.log('\n🧹 Cleaning DB for teacher:', TEACHER_ID);
  await supabaseAdmin.from('whatsapp_auth_keys').delete().eq('teacher_id', TEACHER_ID);
  await supabaseAdmin.from('whatsapp_auth_creds').delete().eq('id', TEACHER_ID);
  await supabaseAdmin.from('whatsapp_sessions').delete().eq('teacher_id', TEACHER_ID);
  console.log('✅ DB cleaned');
}

async function checkDB(label) {
  const s = await supabaseAdmin.from('whatsapp_sessions').select('teacher_id,status,phone_number').eq('teacher_id', TEACHER_ID);
  const k = await supabaseAdmin.from('whatsapp_auth_keys').select('type,id').eq('teacher_id', TEACHER_ID);
  const c = await supabaseAdmin.from('whatsapp_auth_creds').select('id,teacher_id').eq('id', TEACHER_ID);
  console.log(`\n📊 DB [${label}]: sessions=${JSON.stringify(s.data)} keys=${k.data?.length||0} creds=${c.data?.length||0}`);
}

async function main() {
  const baileys = await import('@whiskeysockets/baileys');
  const { makeWASocket, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = baileys;
  const { useSupabaseAuthState } = require('./lib/baileysAuthState');
  const pino = require('pino');
  const logger = pino({ level: 'silent' });

  console.log('╔══════════════════════════════════════════╗');
  console.log(`║  Pairing: +${PHONE}  Teacher: ${TEACHER_ID.slice(0,8)}...`);
  console.log('╚══════════════════════════════════════════╝');

  await cleanupDB();
  await checkDB('cleaned');

  const { version } = await fetchLatestBaileysVersion();
  console.log('WA version:', version);

  let attempt = 0;
  const MAX_ATTEMPTS = 5;

  async function startSocket() {
    attempt++;
    console.log(`\n🔌 Socket attempt #${attempt}`);

    const authState = await useSupabaseAuthState(TEACHER_ID);
    const { state, saveCreds, flushPendingSave } = authState;

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      printQRInTerminal: false,
      browser: ['Windows', 'Chrome', '114.0.5735.198'],
      logger,
      getMessage: async () => undefined
    });

    let pairingRequested = false;

    sock.ev.on('creds.update', async () => {
      console.log('  🔑 creds.update');
      await saveCreds();
    });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log(`  [conn] ${connection || 'event'} qr=${!!qr} code=${code} json=${JSON.stringify(Object.keys(update))}`);

      if (lastDisconnect) {
        console.log('  [disconnect] error:', lastDisconnect.error?.message, 'output:', JSON.stringify(lastDisconnect.error?.output));
      }

      // Pairing code: request on first QR
      if (qr && !pairingRequested) {
        pairingRequested = true;
        console.log('\n⏳ Requesting pairing code...');
        try {
          const pairCode = await sock.requestPairingCode(PHONE);
          console.log(`\n🔑 YOUR PAIRING CODE: ${pairCode}`);
          console.log('📱 Settings → Linked Devices → Link with Phone Number\n');
        } catch (err) {
          console.error('❌ requestPairingCode failed:', err.message);
        }
      }

      // Connected successfully
      if (connection === 'open') {
        console.log('\n✅ CONNECTED!');
        const phone = sock.user?.id?.split(':')[0]?.split('@')[0];
        console.log('  Phone:', phone);

        await flushPendingSave();
        await supabaseAdmin.from('whatsapp_sessions').upsert({
          teacher_id: TEACHER_ID, status: 'connected',
          phone: `+${phone}`,
          last_active: new Date().toISOString(),
          connected_at: new Date().toISOString()
        }, { onConflict: 'teacher_id' });
        await checkDB('connected');

        // Send test
        console.log('\n📤 Sending test message...');
        try {
          await sock.sendMessage(`${PHONE}@s.whatsapp.net`, { text: '✅ Nabeeh multi-session test!' });
          console.log('  ✅ Sent!');
        } catch (e) { console.error('  ❌', e.message); }

        await new Promise(r => setTimeout(r, 2000));
        await sock.end();
        await checkDB('done');
        console.log('\n🎉 TEST COMPLETE');
        process.exit(0);
      }

      // Connection closed
      if (connection === 'close') {
        if (code === DisconnectReason.loggedOut) {
          console.log('⚠️  Logged out');
          await cleanupDB();
          process.exit(1);
        }
        if (code === DisconnectReason.restartRequired) {
          console.log('🔄 515 restart — flushing and reconnecting in 3s...');
          await flushPendingSave();
          await new Promise(r => setTimeout(r, 3000));
          if (attempt < MAX_ATTEMPTS) {
            startSocket();
          } else {
            console.log('❌ Max attempts reached');
            process.exit(1);
          }
        }
      }
    });
  }

  startSocket();

  setTimeout(() => {
    console.log('\n⏰ Timeout (180s)');
    process.exit(1);
  }, 180000);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
