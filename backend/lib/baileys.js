const { makeWASocket, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const EventEmitter = require('events');
const logger = require('./logger');
const { useSupabaseAuthState } = require('./baileysAuthState');
const { supabaseAdmin } = require('../config/database');

class BaileysClient extends EventEmitter {
  constructor() {
    super();
    this.sock = null;
    this.status = 'disconnected';
    this.qrCode = null;
    this.isInitializing = false;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 30000;
    this.lastMessageTime = null;
    this.watchdogInterval = null;
    this.SILENCE_THRESHOLD = 25 * 60 * 1000;
    this.qrExpiryTimer = null;
    this.QR_EXPIRY_MS = 18000;
    this.pairingCodeMode = false;
    this._readyResolve = null;
    this._readyReject = null;
  }

  emitStatus(extra = {}) {
    this.emit('connection.update', {
      status: this.status,
      qr: this.qrCode,
      ...extra
    });
  }

  waitForReady(timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      if (this.status === 'qr_ready' || this.status === 'connected') {
        return resolve();
      }
      this._readyResolve = resolve;
      this._readyReject = reject;
      this._readyTimer = setTimeout(() => {
        this._readyResolve = null;
        this._readyReject = null;
        reject(new Error('Timeout waiting for WhatsApp socket to be ready'));
      }, timeoutMs);
    });
  }

  _signalReady() {
    if (this._readyResolve) {
      clearTimeout(this._readyTimer);
      this._readyResolve();
      this._readyResolve = null;
      this._readyReject = null;
    }
  }

  async connect() {
    if (this.isInitializing) return;

    this.isInitializing = true;
    this.status = 'connecting';
    this.emitStatus();

    try {
      if (this.sock && typeof this.sock.removeAllListeners === 'function') {
        this.sock.removeAllListeners();
      }

      const { state, saveCreds } = await useSupabaseAuthState();
      const { version } = await fetchLatestBaileysVersion();

      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger)
        },
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        getMessage: async () => undefined
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
      this.clearQrExpiryTimer();
      try {
        this.qrCode = await qrcode.toDataURL(qr);
      } catch (err) {
        logger.error('QR encoding failed', { error: err.message });
        this.qrCode = null;
      }
      this.status = 'qr_ready';
      this.emitStatus();
      this._signalReady();

      // Only set QR expiry timer if NOT in pairing code mode
      if (!this.pairingCodeMode) {
        this.qrExpiryTimer = setTimeout(() => {
          if (this.status === 'qr_ready') {
            logger.info('QR expired, requesting new one');
            this.qrCode = null;
            this.status = 'connecting';
            this.emitStatus();
            this.sock?.end();
          }
        }, this.QR_EXPIRY_MS);
      }
    }

    if (connection === 'open') {
      this.clearQrExpiryTimer();
      this.pairingCodeMode = false;
      this.status = 'connected';
      this.qrCode = null;
      this.reconnectAttempts = 0;
      this.lastMessageTime = Date.now();
      this.connectedPhone = this.sock?.user?.id?.split(':')[0]?.split('@')[0] || null;
      logger.info('Connected', { userId: this.sock?.user?.id, phone: this.connectedPhone, name: this.sock?.user?.name });
      this.startWatchdog();
      this.emitStatus();
      return;
    }

    if (connection === 'close') {
      this.clearQrExpiryTimer();
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      const restartRequired = statusCode === DisconnectReason.restartRequired;

      this.status = 'disconnected';
      this.stopWatchdog();
      this.emitStatus();

      if (loggedOut) {
        await this.clearSession();
      } else if (restartRequired) {
        logger.info('Restart required after pairing, reconnecting');
        this.connect().catch((error) => logger.error('Reconnection error', { error: error.message }));
      } else {
        this.scheduleReconnect();
      }
    }
  }

  handleIncomingMessages({ type, messages }) {
    if (type !== 'notify' || !Array.isArray(messages)) return;

    for (const msg of messages) {
      if (msg.key?.fromMe) continue;
      this.lastMessageTime = Date.now();
      this.emit('message', msg);
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;

    logger.info('Scheduling reconnect', { delay, attempt: this.reconnectAttempts });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => logger.error('Reconnection error', { error: error.message }));
    }, delay);
  }

  startWatchdog() {
    this.stopWatchdog();
    this.watchdogInterval = setInterval(() => {
      if (this.status !== 'connected') return;
      if (this.lastMessageTime && Date.now() - this.lastMessageTime > this.SILENCE_THRESHOLD) {
        logger.warn('Deaf session detected, forcing reconnect');
        this.sock?.end();
      }
    }, 60 * 1000);
  }

  stopWatchdog() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  clearQrExpiryTimer() {
    if (this.qrExpiryTimer) {
      clearTimeout(this.qrExpiryTimer);
      this.qrExpiryTimer = null;
    }
  }

  async clearSession() {
    try {
      await supabaseAdmin.from('whatsapp_auth_keys').delete().neq('type', '__none__');
      await supabaseAdmin.from('whatsapp_auth_creds').delete().eq('id', 'default');
    } catch (err) {
      logger.warn('Error clearing auth state', { error: err.message });
    }
    this.qrCode = null;
  }

  async startPairing() {
    await this.logout();
    await this.connect();
    return this.getStatus();
  }

  async requestPairingCode(phoneNumber) {
    if (!this.sock) {
      throw new Error('WhatsApp socket not initialized.');
    }

    this.pairingCodeMode = true;
    try {
      const code = await this.sock.requestPairingCode(phoneNumber);
      logger.info('Pairing code requested', { phoneNumber, code });
      return code;
    } catch (error) {
      this.pairingCodeMode = false;
      logger.error('requestPairingCode failed', { error: error.message });
      throw error;
    }
  }

  async sendMessage(to, content) {
    if (!this.sock) {
      throw new Error('WhatsApp socket not initialized');
    }

    const cleaned = to.replace('+', '').replace(/[^0-9]/g, '');
    const jid = `${cleaned}@s.whatsapp.net`;
    logger.info('Sending message', { to: cleaned, jid });
    await this.sock.sendMessage(jid, { text: content });
    logger.info('Message sent OK', { jid });
  }

  getStatus() {
    return {
      status: this.status,
      qr: this.qrCode,
      phone: this.connectedPhone ? `+${this.connectedPhone}` : null
    };
  }

  async logout() {
    try {
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }

      this.clearQrExpiryTimer();
      this.stopWatchdog();

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
      this.reconnectAttempts = 0;
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
