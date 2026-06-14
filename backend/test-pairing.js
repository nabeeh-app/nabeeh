const { makeWASocket, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, initAuthCreds, proto } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const logger = pino({ level: 'silent' });
const PHONE = process.argv[2] || '201211310357';
const AUTH_DIR = path.join(__dirname, '.test_auth');

// Simple file-based auth state
function useFileAuthState() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  const credsPath = path.join(AUTH_DIR, 'creds.json');
  const state = { creds: fs.existsSync(credsPath) ? JSON.parse(fs.readFileSync(credsPath, 'utf-8')) : initAuthCreds(), keys: {} };

  return {
    state,
    saveCreds: async () => {
      fs.writeFileSync(credsPath, JSON.stringify(state.creds, null, 2));
    }
  };
}

async function main() {
  console.log(`\n📱 Requesting pairing code for: ${PHONE}\n`);

  // Clear old auth
  if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true });

  const { version } = await fetchLatestBaileysVersion();
  console.log('WA version:', version);

  const { state, saveCreds } = useFileAuthState();

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    logger,
    getMessage: async () => undefined
  });

  let codeSent = false;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    console.log('[connection.update]', { connection, hasQr: !!qr, statusCode: lastDisconnect?.error?.output?.statusCode });

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log('[close] statusCode:', statusCode);
      if (statusCode === DisconnectReason.restartRequired) {
        console.log('\n✅ Pairing SUCCESS! (restartRequired)\n');
        process.exit(0);
      }
      process.exit(1);
    }

    if (qr && !codeSent) {
      codeSent = true;
      console.log('\n⏳ QR received, requesting pairing code...');
      try {
        const code = await sock.requestPairingCode(PHONE);
        console.log(`\n🔑 YOUR PAIRING CODE: ${code}\n`);
        console.log('Enter this code on your phone: Settings → Linked Devices → Link with Phone Number\n');
      } catch (err) {
        console.error('❌ requestPairingCode failed:', err.message);
        process.exit(1);
      }
    }
  });

  setTimeout(() => {
    console.log('\n⏰ Timeout — no pairing confirmed in 120 seconds');
    process.exit(1);
  }, 120000);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
