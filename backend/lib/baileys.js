const { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const logger = require('./logger');

class BaileysClient extends EventEmitter {
  constructor() {
    super();
    this.sock = null;
    this.status = 'disconnected';
    this.qrCode = null;
    this.authFolder = path.join(__dirname, '../auth_info_baileys');
    this.isInitializing = false;
    this.reconnectTimer = null;

    this.ensureAuthFolder();
  }

  ensureAuthFolder() {
    if (!fs.existsSync(this.authFolder)) {
      fs.mkdirSync(this.authFolder, { recursive: true });
    }
  }

  emitStatus(extra = {}) {
    this.emit('connection.update', {
      status: this.status,
      qr: this.qrCode,
      ...extra
    });
  }

  async connect() {
    if (this.isInitializing) return;

    this.isInitializing = true;
    this.status = 'connecting';
    this.emitStatus();

    try {
      this.ensureAuthFolder();
      const { state, saveCreds } = await useMultiFileAuthState(this.authFolder);
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        browser: ['Nabeeh', 'Chrome', '1.0.0']
      });

      this.sock.ev.on('creds.update', saveCreds);
      this.sock.ev.on('connection.update', (update) => this.handleConnectionUpdate(update));
      this.sock.ev.on('messages.upsert', (update) => this.handleIncomingMessages(update));
    } catch (error) {
      logger.error('Baileys connect error', { error: error.message });
      this.status = 'error';
      this.emitStatus({ error: error.message });
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        this.qrCode = await qrcode.toDataURL(qr);
      } catch (err) {
        logger.error('QR encoding failed', { error: err.message });
        this.qrCode = null;
      }
      this.status = 'qr_ready';
      this.emitStatus();
    }

    if (connection === 'open') {
      this.status = 'connected';
      this.qrCode = null;
      this.emitStatus();
      return;
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      this.status = 'disconnected';
      this.emitStatus();

      if (loggedOut) {
        await this.clearSession();
      } else {
        this.scheduleReconnect();
      }
    }
  }

  handleIncomingMessages({ type, messages }) {
    if (type !== 'notify' || !Array.isArray(messages)) return;

    for (const msg of messages) {
      if (msg.key?.fromMe) continue;
      this.emit('message', msg);
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => logger.error('Reconnection error', { error: error.message }));
    }, 2000);
  }

  async clearSession() {
    if (fs.existsSync(this.authFolder)) {
      fs.rmSync(this.authFolder, { recursive: true, force: true });
    }
    this.ensureAuthFolder();
    this.qrCode = null;
  }

  async startPairing() {
    await this.logout();
    await this.connect();
    return this.getStatus();
  }

  async sendMessage(to, content) {
    if (!this.sock) {
      throw new Error('WhatsApp socket not initialized');
    }

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    await this.sock.sendMessage(jid, { text: content });
  }

  getStatus() {
    return {
      status: this.status,
      qr: this.qrCode
    };
  }

  async logout() {
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      if (this.sock) {
        try {
          await this.sock.logout();
        } catch (error) {
          logger.warn('Baileys logout warning', { error: error.message });
        }

        if (typeof this.sock.end === 'function') {
          this.sock.end();
        }
        this.sock = null;
      }

      await this.clearSession();
      this.status = 'disconnected';
      this.emitStatus();
      return true;
    } catch (error) {
      logger.error('Logout error', { error: error.message });
      return false;
    }
  }
}

const baileysClient = new BaileysClient();

module.exports = { baileysClient };
