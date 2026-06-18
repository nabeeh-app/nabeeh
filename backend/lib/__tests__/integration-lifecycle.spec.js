/**
 * Integration test: Full WhatsApp multi-session lifecycle
 */

const EventEmitter = require('events');

var mockSocket;

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,FAKEQR')
}));

jest.mock('@whiskeysockets/baileys', () => {
  const EventEmitter = require('events');
  const ev = new EventEmitter();
  const socket = {
    ev,
    end: jest.fn(),
    sendMessage: jest.fn().mockResolvedValue({ key: { id: 'msg_test' } }),
    sendPresenceUpdate: jest.fn().mockResolvedValue(undefined),
    requestPairingCode: jest.fn().mockResolvedValue('12345678'),
    user: { id: '12345@s.whatsapp.net', name: 'TestBot' }
  };
  mockSocket = socket;
  return {
    makeWASocket: jest.fn(() => socket),
    DisconnectReason: { loggedOut: 401, connectionClosed: 408, connectionReplaced: 440, timedOut: 408, restartRequired: 515 },
    fetchLatestBaileysVersion: jest.fn().mockResolvedValue({ version: [2, 2409, 2] }),
    makeCacheableSignalKeyStore: jest.fn((k) => k)
  };
});

jest.mock('../logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

jest.mock('../baileysAuthState', () => ({
  useSupabaseAuthState: jest.fn().mockResolvedValue({
    state: { creds: {}, keys: {} },
    saveCreds: jest.fn(),
    cancelPendingSave: jest.fn(),
    flushPendingSave: jest.fn().mockResolvedValue(undefined)
  })
}));

function makeResultPromise(data, error) {
  const result = { data: data || null, error: error || null };
  const p = Promise.resolve(result);
  return {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    upsert: jest.fn().mockResolvedValue(result),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p)
  };
}
function makeChain(data, error) {
  const builder = makeResultPromise(data, error);
  // from() returns a non-thenable QueryBuilder
  return {
    select: jest.fn().mockReturnValue(builder),
    insert: jest.fn().mockReturnValue(builder),
    update: jest.fn().mockReturnValue(builder),
    delete: jest.fn().mockReturnValue(builder),
    upsert: jest.fn().mockReturnValue(builder)
  };
}
const defaultChain = () => makeChain(null, null);

jest.mock('../../config/database', () => ({
  supabaseAdmin: { from: jest.fn(defaultChain) }
}));

jest.mock('../phone', () => ({
  normalizePhoneNumber: jest.fn((p) => {
    if (!p || typeof p !== 'string') return '%';
    return p.replace(/^00/, '').replace(/^\+/, '');
  })
}));

const { BaileysClient } = require('../baileys');
const sessionManager = require('../sessionManager');
const supabaseAdmin = require('../../config/database').supabaseAdmin;

describe('Integration: Full multi-session lifecycle', () => {
  beforeEach(() => {
    sessionManager.sessions.clear();
    sessionManager._started = false;
    sessionManager.pending.clear();
    sessionManager.maxSessions = 50;
    supabaseAdmin.from.mockImplementation(defaultChain);
    // Reset mock socket state
    mockSocket.ev.removeAllListeners();
    mockSocket.end.mockClear();
    mockSocket.sendMessage.mockClear();
    mockSocket.requestPairingCode.mockClear();
    mockSocket.user = { id: '12345@s.whatsapp.net', name: 'TestBot' };
  });

  afterEach(async () => {
    jest.useRealTimers();
    if (sessionManager._started) await sessionManager.stop();
    sessionManager.sessions.clear();
    sessionManager._started = false;
    sessionManager.pending.clear();
  });

  describe('Session creation and connection', () => {
    test('creates a session and connects to "open"', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      expect(client).toBeInstanceOf(BaileysClient);
      expect(sessionManager.sessions.has('teacher-1')).toBe(true);

      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      expect(client.status).toBe('connected');
    });

    test('emits sessionCreated event', async () => {
      const handler = jest.fn();
      sessionManager.on('sessionCreated', handler);
      await sessionManager.getOrCreateSession('teacher-1');
      expect(handler).toHaveBeenCalledWith({
        teacherId: 'teacher-1',
        client: expect.any(BaileysClient)
      });
    });

    test('returns existing session on second call', async () => {
      const c1 = await sessionManager.getOrCreateSession('teacher-1');
      const c2 = await sessionManager.getOrCreateSession('teacher-1');
      expect(c1).toBe(c2);
      expect(sessionManager.sessions.size).toBe(1);
    });
  });

  describe('Message routing', () => {
    test('incoming message is received via event', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      const received = [];
      client.on('message', (msg) => received.push(msg));

      mockSocket.ev.emit('messages.upsert', {
        messages: [{
          key: { id: 'msg-001', remoteJid: '201012345678@s.whatsapp.net', fromMe: false },
          message: { conversation: 'Hello teacher 1' },
          messageTimestamp: Date.now()
        }],
        type: 'notify'
      });
      await new Promise(r => setTimeout(r, 10));
      expect(received).toHaveLength(1);
      expect(received[0].message.conversation).toBe('Hello teacher 1');
    });

    test('getTeacherForPhone resolves parent → student → teacher', async () => {
      const teacherData = {
        id: 'parent-1',
        students: [{
          id: 's1',
          enrollments: [{ id: 'e1', group: { id: 'g1', offering: { id: 'o1', teacher_id: 'teacher-1' } } }]
        }]
      };
      supabaseAdmin.from.mockReturnValue(makeChain(teacherData, null));
      const teachers = await sessionManager.getTeacherForPhone('+201012345678');
      expect(teachers).toEqual(['teacher-1']);
    });

    test('getTeacherForPhone returns null for unknown phone', async () => {
      supabaseAdmin.from.mockReturnValue(makeChain(null, { message: 'not found' }));
      const teachers = await sessionManager.getTeacherForPhone('+209999999999');
      expect(teachers).toBeNull();
    });
  });

  describe('Message sending', () => {
    test('sendMessage uses correct socket and normalizes phone', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      await client.sendMessage('+201012345678', 'Hello from teacher');
      expect(mockSocket.sendMessage).toHaveBeenCalledWith(
        '201012345678@s.whatsapp.net',
        { text: 'Hello from teacher' }
      );
    });

    test('sendMessage throws if socket not connected', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1', { autoConnect: false });
      await expect(client.sendMessage('+201012345678', 'test'))
        .rejects.toThrow('WhatsApp socket not initialized');
    });
  });

  describe('Session lifecycle', () => {
    test('disconnect() cleans up socket', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      expect(client.status).toBe('connected');
      await client.disconnect();
      expect(client.status).toBe('disconnected');
      expect(client.sock).toBeNull();
    });

    test('reconnect on non-loggedOut close', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      mockSocket.ev.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 408 } } }
      });
      await new Promise(r => setTimeout(r, 10));
      expect(client.status).toBe('disconnected');
      expect(client.reconnectAttempts).toBe(1);
    });
  });

  describe('Session limit', () => {
    test('evicts oldest when limit reached', async () => {
      sessionManager.maxSessions = 2;
      await sessionManager.getOrCreateSession('t1');
      await sessionManager.getOrCreateSession('t2');
      await sessionManager.getOrCreateSession('t3');
      expect(sessionManager.sessions.has('t1')).toBe(false);
      expect(sessionManager.sessions.has('t3')).toBe(true);
    });
  });

  describe('waitForReady', () => {
    test('resolves on connected', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      const p = client.waitForReady(5000);
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await expect(p).resolves.toBeUndefined();
    });

    test('rejects on timeout', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      await expect(client.waitForReady(50)).rejects.toThrow('Timeout');
    });
  });

  describe('QR code flow', () => {
    test('qr_ready when QR received', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      const statuses = [];
      client.on('connection.update', (u) => statuses.push(u.status));
      mockSocket.ev.emit('connection.update', { qr: 'test-qr' });
      await new Promise(r => setTimeout(r, 10));
      expect(statuses).toContain('qr_ready');
      expect(client.qrCode).toBeTruthy();
    });
  });

  describe('Max reconnect', () => {
    test('stops after MAX_RECONNECT_ATTEMPTS', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      client.reconnectAttempts = 50;
      const statuses = [];
      client.on('connection.update', (u) => statuses.push(u));
      client.scheduleReconnect();
      await new Promise(r => setTimeout(r, 20));
      const failed = statuses.find((u) => u.status === 'failed');
      expect(failed).toBeTruthy();
      expect(failed.error).toBe('Max reconnect attempts reached');
    });
  });

  describe('Multi-teacher isolation', () => {
    test('each teacher has independent client', async () => {
      const c1 = await sessionManager.getOrCreateSession('teacher-1');
      const c2 = await sessionManager.getOrCreateSession('teacher-2');
      const c3 = await sessionManager.getOrCreateSession('teacher-3');
      expect(c1).not.toBe(c2);
      expect(c2).not.toBe(c3);
      expect(c1.teacherId).toBe('teacher-1');
      expect(sessionManager.sessions.size).toBe(3);
    });

    test('disconnecting one does not affect others', async () => {
      const c1 = await sessionManager.getOrCreateSession('teacher-1');
      const c2 = await sessionManager.getOrCreateSession('teacher-2');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      await c1.disconnect();
      expect(c1.status).toBe('disconnected');
      expect(c2.status).toBe('connected');
    });
  });

  describe('LoggedOut (401) clears credentials', () => {
    test('loggedOut clears session and does not reconnect', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      expect(client.status).toBe('connected');

      mockSocket.ev.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 401 } } }
      });
      await new Promise(r => setTimeout(r, 50));
      expect(client.status).toBe('disconnected');
      expect(client.sock).toBeNull();
      expect(client.reconnectAttempts).toBe(0);
      expect(supabaseAdmin.from).toHaveBeenCalledWith('whatsapp_auth_keys');
      expect(supabaseAdmin.from).toHaveBeenCalledWith('whatsapp_auth_creds');
    });

    test('loggedOut removes session from manager', async () => {
      await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      expect(sessionManager.sessions.has('teacher-1')).toBe(true);

      mockSocket.ev.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 401 } } }
      });
      await new Promise(r => setTimeout(r, 50));
    });
  });

  describe('connectionReplaced (440)', () => {
    test('connectionReplaced falls through to reconnect', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      mockSocket.ev.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 440 } } }
      });
      await new Promise(r => setTimeout(r, 10));
      expect(client.status).toBe('disconnected');
      expect(client.reconnectAttempts).toBe(1);
    });
  });

  describe('DB failure handling', () => {
    test('session creation continues even if DB upsert fails', async () => {
      supabaseAdmin.from.mockImplementation(() => ({
        ...defaultChain(),
        upsert: jest.fn().mockResolvedValue({ error: { message: 'DB connection refused' } })
      }));
      const client = await sessionManager.getOrCreateSession('teacher-1');
      expect(client).toBeInstanceOf(BaileysClient);
      expect(sessionManager.sessions.has('teacher-1')).toBe(true);
    });

    test('status update continues even if DB update fails', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      supabaseAdmin.from.mockImplementation(() => ({
        ...defaultChain(),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'DB timeout' } })
        })
      }));
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      expect(client.status).toBe('connected');
    });

    test('clearSession handles DB delete failure gracefully', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      supabaseAdmin.from.mockImplementation(() => ({
        ...defaultChain(),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockRejectedValue(new Error('DB down'))
        })
      }));
      await expect(client.clearSession()).resolves.not.toThrow();
      expect(client.qrCode).toBeNull();
    });
  });

  describe('stop() with active sessions', () => {
    test('stop disconnects all sessions and clears map', async () => {
      await sessionManager.getOrCreateSession('teacher-1');
      await sessionManager.getOrCreateSession('teacher-2');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      sessionManager._started = true;

      await sessionManager.stop();
      expect(sessionManager.sessions.size).toBe(0);
      expect(sessionManager._started).toBe(false);
    });

    test('stop handles disconnect errors gracefully', async () => {
      const c1 = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      c1._flushPendingSave = jest.fn().mockRejectedValue(new Error('flush failed'));
      sessionManager._started = true;

      await expect(sessionManager.stop()).resolves.not.toThrow();
      expect(sessionManager.sessions.size).toBe(0);
    });
  });

  describe('connectAll() restoring from DB', () => {
    test('restores sessions from database on startup', async () => {
      const sessionsData = [
        { teacher_id: 't1', status: 'connected' },
        { teacher_id: 't2', status: 'error' }
      ];
      const queryChain = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: sessionsData, error: null })
      };
      supabaseAdmin.from.mockReturnValue(queryChain);

      sessionManager._started = true;
      await sessionManager.connectAll();
      expect(sessionManager.sessions.size).toBe(2);
      expect(sessionManager.sessions.has('t1')).toBe(true);
      expect(sessionManager.sessions.has('t2')).toBe(true);
    });

    test('handles empty database gracefully', async () => {
      const queryChain = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null })
      };
      supabaseAdmin.from.mockReturnValue(queryChain);

      await sessionManager.connectAll();
      expect(sessionManager.sessions.size).toBe(0);
    });

    test('handles DB error during connectAll', async () => {
      const queryChain = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: null, error: { message: 'connection refused' } })
      };
      supabaseAdmin.from.mockReturnValue(queryChain);

      await expect(sessionManager.connectAll()).resolves.not.toThrow();
    });
  });

  describe('Snapshot and status methods', () => {
    test('getSessionsSnapshot returns array of session info', async () => {
      await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      const snapshot = sessionManager.getSessionsSnapshot();
      expect(snapshot).toHaveLength(1);
      expect(snapshot[0].teacherId).toBe('teacher-1');
      expect(snapshot[0].status).toBe('connected');
      expect(snapshot[0].phone).toBe('+12345');
    });

    test('getStatus returns all sessions with limits', async () => {
      await sessionManager.getOrCreateSession('teacher-1');
      await sessionManager.getOrCreateSession('teacher-2');

      const status = sessionManager.getStatus();
      expect(status.totalSessions).toBe(2);
      expect(status.maxSessions).toBe(50);
      expect(status.sessions['teacher-1']).toBeDefined();
      expect(status.sessions['teacher-2']).toBeDefined();
    });

    test('getTeacherStatus returns null for unknown teacher', () => {
      expect(sessionManager.getTeacherStatus('nonexistent')).toBeNull();
    });

    test('getTeacherStatus returns status for known teacher', async () => {
      await sessionManager.getOrCreateSession('teacher-1');
      const status = sessionManager.getTeacherStatus('teacher-1');
      expect(status).not.toBeNull();
      expect(status.teacherId).toBe('teacher-1');
      expect(status.lastActive).toBeDefined();
    });
  });

  describe('requestPairingCode', () => {
    test('returns pairing code when socket connected', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      const code = await client.requestPairingCode('201012345678');
      expect(code).toBe('12345678');
      expect(mockSocket.requestPairingCode).toHaveBeenCalledWith('201012345678');
      expect(client.pairingCodeMode).toBe(true);
    });

    test('throws if socket not initialized', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1', { autoConnect: false });
      await expect(client.requestPairingCode('201012345678')).rejects.toThrow('WhatsApp socket not initialized');
    });

    test('resets pairingCodeMode on error', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      mockSocket.requestPairingCode.mockRejectedValueOnce(new Error('pairing failed'));
      await expect(client.requestPairingCode('201012345678')).rejects.toThrow('pairing failed');
      expect(client.pairingCodeMode).toBe(false);
    });
  });

  describe('startPairing()', () => {
    test('startPairing calls logout then connect', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      const spy = { logout: jest.spyOn(client, 'logout'), connect: jest.spyOn(client, 'connect') };

      const status = await client.startPairing();

      expect(client.logout).toHaveBeenCalled();
      expect(client.connect).toHaveBeenCalled();
      expect(status).toHaveProperty('status');
    });

    test('startPairing returns status object', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      const status = await client.startPairing();

      expect(status).toEqual(expect.objectContaining({
        status: expect.any(String),
        teacherId: 'teacher-1'
      }));
    });
  });

  describe('logout() flow', () => {
    test('logout clears socket and credentials', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      const result = await client.logout();
      expect(result).toBe(true);
      expect(client.status).toBe('disconnected');
      expect(client.sock).toBeNull();
      expect(client.reconnectAttempts).toBe(0);
    });

    test('logout calls clearSession which deletes credentials', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      await client.logout();
      expect(supabaseAdmin.from).toHaveBeenCalledWith('whatsapp_auth_keys');
      expect(supabaseAdmin.from).toHaveBeenCalledWith('whatsapp_auth_creds');
    });

    test('logout handles flush error gracefully', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));
      client._flushPendingSave = jest.fn().mockRejectedValue(new Error('flush failed'));

      const result = await client.logout();
      expect(result).toBe(false);
    });
  });

  describe('Watchdog', () => {
    test('watchdog detects dead session after silence threshold', async () => {
      jest.useFakeTimers();
      try {
        const client = await sessionManager.getOrCreateSession('teacher-1');
        mockSocket.ev.emit('connection.update', { connection: 'open' });
        jest.advanceTimersByTime(10);

        expect(client.status).toBe('connected');
        expect(client.watchdogInterval).not.toBeNull();

        client.lastMessageTime = Date.now() - (30 * 60 * 1000);
        jest.advanceTimersByTime(60 * 1000);
        expect(mockSocket.end).toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    test('watchdog does not fire when connected and receiving messages', async () => {
      jest.useFakeTimers();
      try {
        const client = await sessionManager.getOrCreateSession('teacher-1');
        mockSocket.ev.emit('connection.update', { connection: 'open' });
        jest.advanceTimersByTime(10);

        client.lastMessageTime = Date.now();
        jest.advanceTimersByTime(60 * 1000);
        expect(mockSocket.end).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('QR expiry timer', () => {
    const flushMicrotasks = () => Promise.resolve().then(() => Promise.resolve());

    test('QR expires after QR_EXPIRY_MS and requests new one', async () => {
      jest.useFakeTimers();
      try {
        const client = await sessionManager.getOrCreateSession('teacher-1');
        mockSocket.ev.emit('connection.update', { qr: 'test-qr' });
        await flushMicrotasks();
        jest.advanceTimersByTime(1);

        expect(client.status).toBe('qr_ready');
        expect(client.qrCode).toBeTruthy();

        jest.advanceTimersByTime(18000);
        expect(client.qrCode).toBeNull();
        expect(client.status).toBe('connecting');
        expect(mockSocket.end).toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    test('QR expiry cancelled if connected before expiry', async () => {
      jest.useFakeTimers();
      try {
        const client = await sessionManager.getOrCreateSession('teacher-1');
        mockSocket.ev.emit('connection.update', { qr: 'test-qr' });
        await flushMicrotasks();
        jest.advanceTimersByTime(1);
        expect(client.qrExpiryTimer).not.toBeNull();

        mockSocket.ev.emit('connection.update', { connection: 'open' });
        await flushMicrotasks();
        jest.advanceTimersByTime(1);
        expect(client.qrExpiryTimer).toBeNull();
        jest.advanceTimersByTime(20000);
        expect(client.status).toBe('connected');
      } finally {
        jest.useRealTimers();
      }
    });

    test('QR expiry not set in pairing code mode', async () => {
      jest.useFakeTimers();
      try {
        const client = await sessionManager.getOrCreateSession('teacher-1');
        mockSocket.ev.emit('connection.update', { connection: 'open' });
        await flushMicrotasks();
        jest.advanceTimersByTime(1);

        client.pairingCodeMode = true;
        mockSocket.ev.emit('connection.update', { qr: 'test-qr' });
        await flushMicrotasks();
        jest.advanceTimersByTime(1);
        expect(client.qrExpiryTimer).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('Pending request deduplication', () => {
    test('concurrent calls for same teacher share one session', async () => {
      const p1 = sessionManager.getOrCreateSession('teacher-1');
      const p2 = sessionManager.getOrCreateSession('teacher-1');
      const [c1, c2] = await Promise.all([p1, p2]);
      expect(c1).toBe(c2);
      expect(sessionManager.sessions.size).toBe(1);
    });

    test('pending set cleared even if connect fails', async () => {
      const originalConnect = BaileysClient.prototype.connect;
      BaileysClient.prototype.connect = jest.fn().mockRejectedValue(new Error('connect failed'));
      try {
        await sessionManager.getOrCreateSession('teacher-1').catch(() => {});
        expect(sessionManager.pending.has('teacher-1')).toBe(false);
        const c2 = await sessionManager.getOrCreateSession('teacher-1', { autoConnect: false });
        expect(c2).toBeInstanceOf(BaileysClient);
      } finally {
        BaileysClient.prototype.connect = originalConnect;
      }
    });
  });

  describe('Eviction edge cases', () => {
    test('_evictInactiveSession returns false when no sessions', async () => {
      const result = await sessionManager._evictInactiveSession();
      expect(result).toBe(false);
    });

    test('_evictInactiveSession evicts oldest when all recently active', async () => {
      await sessionManager.getOrCreateSession('t1');
      await new Promise(r => setTimeout(r, 5));
      await sessionManager.getOrCreateSession('t2');

      const result = await sessionManager._evictInactiveSession();
      expect(result).toBe(true);
      expect(sessionManager.sessions.size).toBe(1);
      expect(sessionManager.sessions.has('t2')).toBe(true);
    });

    test('_evictInactiveSession returns false if destroySession throws', async () => {
      await sessionManager.getOrCreateSession('t1');
      const origDestroy = sessionManager.destroySession.bind(sessionManager);
      sessionManager.destroySession = jest.fn().mockRejectedValue(new Error('destroy failed'));

      const result = await sessionManager._evictInactiveSession();
      expect(result).toBe(false);
      sessionManager.destroySession = origDestroy;
    });
  });

  describe('restartRequired reconnect', () => {
    test('restartRequired triggers reconnect with backoff', async () => {
      jest.useFakeTimers();
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await jest.advanceTimersByTimeAsync(10);

      const spy = jest.spyOn(client, 'connect');
      mockSocket.ev.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 515 } } }
      });
      await jest.advanceTimersByTimeAsync(10);

      expect(client.reconnectTimer).not.toBeNull();
      expect(spy).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(5000);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
      jest.useRealTimers();
    });
  });

  describe('waitForReady edge cases', () => {
    test('resolves immediately if already connected', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      await expect(client.waitForReady(1000)).resolves.toBeUndefined();
    });

    test('resolves immediately if already qr_ready', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { qr: 'test-qr' });
      await new Promise(r => setTimeout(r, 10));

      await expect(client.waitForReady(1000)).resolves.toBeUndefined();
    });

    test('rejects when socket disconnects while waiting', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      const p = client.waitForReady(5000);
      client._rejectWaiters(new Error('Session disconnected'));
      await expect(p).rejects.toThrow('Session disconnected');
    });
  });

  describe('connect() error handling', () => {
    test('connect sets error status on auth state failure', async () => {
      const { useSupabaseAuthState } = require('../baileysAuthState');
      useSupabaseAuthState.mockRejectedValueOnce(new Error('auth failed'));

      const client = await sessionManager.getOrCreateSession('teacher-1', { autoConnect: false });
      await client.connect();
      expect(client.status).toBe('error');
    });

    test('connect sets isInitializing to false after error', async () => {
      const { useSupabaseAuthState } = require('../baileysAuthState');
      useSupabaseAuthState.mockRejectedValueOnce(new Error('auth failed'));

      const client = await sessionManager.getOrCreateSession('teacher-1', { autoConnect: false });
      await client.connect();
      expect(client.isInitializing).toBe(false);
    });

    test('connect skips if already initializing', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1', { autoConnect: false });
      client.isInitializing = true;
      await client.connect();
      expect(client.status).toBe('disconnected');
    });
  });

  describe('disconnect() edge cases', () => {
    test('disconnect returns false on flush error', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      client._flushPendingSave = jest.fn().mockRejectedValue(new Error('flush failed'));
      const result = await client.disconnect();
      expect(result).toBe(false);
      expect(client.status).toBe('disconnected');
    });

    test('disconnect without pending save still works', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1', { autoConnect: false });
      client._flushPendingSave = null;
      const result = await client.disconnect();
      expect(result).toBe(true);
    });
  });

  describe('clearSession edge cases', () => {
    test('clearSession refuses without valid teacherId', async () => {
      supabaseAdmin.from.mockClear();
      const client = new BaileysClient('default');
      await client.clearSession();
      expect(supabaseAdmin.from).not.toHaveBeenCalledWith('whatsapp_auth_keys');
    });

    test('clearSession calls cancelPendingSave', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      client._cancelPendingSave = jest.fn();
      await client.clearSession();
      expect(client._cancelPendingSave).toHaveBeenCalled();
    });
  });

  describe('handleIncomingMessages edge cases', () => {
    test('ignores type !== notify', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      const received = [];
      client.on('message', (msg) => received.push(msg));

      client.handleIncomingMessages({ type: 'append', messages: [{ key: { fromMe: false } }] });
      expect(received).toHaveLength(0);
    });

    test('ignores fromMe messages', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      const received = [];
      client.on('message', (msg) => received.push(msg));

      client.handleIncomingMessages({
        type: 'notify',
        messages: [{ key: { fromMe: true }, message: { conversation: 'outgoing' } }]
      });
      expect(received).toHaveLength(0);
    });

    test('ignores non-array messages', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      const received = [];
      client.on('message', (msg) => received.push(msg));

      client.handleIncomingMessages({ type: 'notify', messages: null });
      expect(received).toHaveLength(0);
    });
  });

  describe('getStatus() details', () => {
    test('getStatus includes connected phone', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1');
      mockSocket.user = { id: '201012345678:s.whatsapp.net', name: 'TestBot' };
      mockSocket.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      const status = client.getStatus();
      expect(status.phone).toBe('+201012345678');
      expect(status.status).toBe('connected');
    });

    test('getStatus returns null phone when not connected', async () => {
      const client = await sessionManager.getOrCreateSession('teacher-1', { autoConnect: false });
      const status = client.getStatus();
      expect(status.phone).toBeNull();
    });
  });
});
