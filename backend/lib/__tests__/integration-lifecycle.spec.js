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
    DisconnectReason: { loggedOut: 401, connectionClosed: 408, connectionReplaced: 440, timedOut: 408 },
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
});
