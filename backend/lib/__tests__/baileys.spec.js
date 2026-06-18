jest.mock('@whiskeysockets/baileys', () => ({
  makeWASocket: jest.fn(),
  DisconnectReason: {
    loggedOut: 401,
    connectionClosed: 408,
    connectionReplaced: 440,
    timedOut: 408
  },
  fetchLatestBaileysVersion: jest.fn().mockResolvedValue({ version: [2, 2409, 2] }),
  makeCacheableSignalKeyStore: jest.fn()
}));

jest.mock('../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../baileysAuthState', () => ({
  useSupabaseAuthState: jest.fn().mockResolvedValue({
    state: { creds: {}, keys: {} },
    saveCreds: jest.fn()
  })
}));

jest.mock('../../config/database', () => ({
  supabaseAdmin: { from: jest.fn().mockReturnThis(), delete: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), neq: jest.fn().mockReturnThis() }
}));

const { BaileysClient } = require('../baileys');

describe('BaileysClient', () => {
  let client;

  beforeEach(() => {
    client = new BaileysClient('teacher-test');
  });

  describe('constructor', () => {
    it('should initialize with teacherId and disconnected status', () => {
      expect(client.teacherId).toBe('teacher-test');
      expect(client.status).toBe('disconnected');
      expect(client.qrCode).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('should return current status', () => {
      const status = client.getStatus();
      expect(status).toHaveProperty('status', 'disconnected');
      expect(status).toHaveProperty('qr', null);
    });
  });

  describe('emitStatus', () => {
    it('should emit connection.update event', () => {
      const listener = jest.fn();
      client.on('connection.update', listener);
      client.emitStatus();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'disconnected' })
      );
    });
  });

  describe('disconnect', () => {
    it('should set status to disconnected', async () => {
      const result = await client.disconnect();
      expect(result).toBe(true);
      expect(client.status).toBe('disconnected');
    });

    it('should clear reconnect timer', async () => {
      client.reconnectTimer = setTimeout(() => {}, 10000);
      await client.disconnect();
      expect(client.reconnectTimer).toBeNull();
    });

    it('should clear QR expiry timer', async () => {
      client.qrExpiryTimer = setTimeout(() => {}, 10000);
      await client.disconnect();
      expect(client.qrExpiryTimer).toBeNull();
    });
  });

  describe('logout', () => {
    it('should set status to disconnected', async () => {
      const result = await client.logout();
      expect(result).toBe(true);
      expect(client.status).toBe('disconnected');
    });
  });

  describe('waitForReady', () => {
    it('should resolve when status becomes connected', async () => {
      const promise = client.waitForReady(1000);
      client.status = 'connected';
      client._signalReady();
      await expect(promise).resolves.toBeUndefined();
    });

    it('should reject on timeout', async () => {
      await expect(client.waitForReady(100)).rejects.toThrow('Timeout');
    });
  });
});
