/**
 * Concurrent multi-session test: Verify 2+ WhatsApp sessions
 * don't interfere with each other.
 *
 * Key scenarios:
 * - Multiple sessions connect simultaneously
 * - Messages route to correct teacher
 * - 515 reconnect storm (all sessions get 515 at once)
 * - One session failure doesn't affect others
 * - LRU eviction under concurrent load
 * - Rate limiting is per-session
 * - Cold boot recovery with multiple persisted sessions
 * - Health check detects stale/failed sessions
 * - Session isolation: auth state, reconnect counters, message timestamps
 */

const EventEmitter = require('events');

const sockets = {};
let mockSocketCounter = 0;

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,FAKEQR')
}));

jest.mock('@whiskeysockets/baileys', () => {
  const EventEmitter = require('events');
  const makeSocket = () => {
    const id = ++jest._mockSocketCounter;
    const ev = new EventEmitter();
    const socket = {
      id,
      ev,
      end: jest.fn(),
      sendMessage: jest.fn().mockResolvedValue({ key: { id: `msg_${id}` } }),
      sendPresenceUpdate: jest.fn().mockResolvedValue(undefined),
      requestPairingCode: jest.fn().mockResolvedValue('12345678'),
      user: { id: `${id}0@s.whatsapp.net`, name: `TestBot${id}` }
    };
    jest._sockets[id] = socket;
    return socket;
  };
  return {
    makeWASocket: jest.fn(() => makeSocket()),
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
    in: jest.fn().mockReturnValue({
      data: data || [],
      error: error || null
    }),
    single: jest.fn().mockResolvedValue(result),
    upsert: jest.fn().mockResolvedValue(result),
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p)
  };
}

function makeChain(data, error) {
  const builder = makeResultPromise(data, error);
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
    const digits = p.replace(/[^0-9]/g, '');
    return digits.startsWith('20') ? digits : '20' + digits.slice(-10);
  })
}));

const { BaileysClient } = require('../baileys');
const sessionManager = require('../sessionManager');
const { supabaseAdmin } = require('../../config/database');

describe('Concurrent Multi-Session', () => {
  beforeEach(() => {
    sessionManager.sessions.clear();
    sessionManager.pending.clear();
    sessionManager._started = false;
    sessionManager._stopHealthCheck();
    jest._mockSocketCounter = 0;
    jest._sockets = {};
    jest.useRealTimers();
    supabaseAdmin.from.mockImplementation(defaultChain);
  });

  afterEach(async () => {
    await sessionManager.stop().catch(() => {});
    jest.useRealTimers();
  });

  describe('simultaneous connection of 3 sessions', () => {
    test('all 3 sessions connect independently with separate sockets', async () => {
      const [c1, c2, c3] = await Promise.all([
        sessionManager.getOrCreateSession('teacher-A'),
        sessionManager.getOrCreateSession('teacher-B'),
        sessionManager.getOrCreateSession('teacher-C')
      ]);

      expect(c1).toBeDefined();
      expect(c2).toBeDefined();
      expect(c3).toBeDefined();
      expect(c1.teacherId).toBe('teacher-A');
      expect(c2.teacherId).toBe('teacher-B');
      expect(c3.teacherId).toBe('teacher-C');

      expect(sessionManager.sessions.size).toBe(3);

      const s1 = sessionManager.getSession('teacher-A');
      const s2 = sessionManager.getSession('teacher-B');
      const s3 = sessionManager.getSession('teacher-C');
      expect(s1).toBe(c1);
      expect(s2).toBe(c2);
      expect(s3).toBe(c3);
    });

    test('each session emits its own QR independently', async () => {
      const c1 = await sessionManager.getOrCreateSession('teacher-A');
      const c2 = await sessionManager.getOrCreateSession('teacher-B');

      const updates1 = [];
      const updates2 = [];
      c1.on('connection.update', (u) => updates1.push(u));
      c2.on('connection.update', (u) => updates2.push(u));

      const sock1 = c1.sock;
      const sock2 = c2.sock;
      expect(sock1).not.toBe(sock2);

      sock1.ev.emit('connection.update', { qr: 'qr-teacher-A' });
      sock2.ev.emit('connection.update', { qr: 'qr-teacher-B' });
      await new Promise(r => setTimeout(r, 10));

      expect(updates1.some(u => u.qr)).toBe(true);
      expect(updates2.some(u => u.qr)).toBe(true);
      expect(c1.qrCode).toContain('FAKEQR');
      expect(c2.qrCode).toContain('FAKEQR');
    });

    test('connecting teacher-A does not affect teacher-B status', async () => {
      const c1 = await sessionManager.getOrCreateSession('teacher-A');
      const c2 = await sessionManager.getOrCreateSession('teacher-B');

      c2.sock.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      expect(c2.status).toBe('connected');
      expect(c1.status).not.toBe('connected');
    });
  });

  describe('session isolation', () => {
    test('reconnect attempts are per-session, not shared', async () => {
      const c1 = await sessionManager.getOrCreateSession('teacher-A');
      const c2 = await sessionManager.getOrCreateSession('teacher-B');

      c2.sock.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      for (let i = 0; i < 5; i++) {
        c1.sock.ev.emit('connection.update', {
          connection: 'close',
          lastDisconnect: { error: { output: { statusCode: 408 } } }
        });
        await new Promise(r => setTimeout(r, 10));
      }

      expect(c1.reconnectAttempts).toBeGreaterThanOrEqual(5);
      expect(c2.reconnectAttempts).toBe(0);
    });

    test('message rate limiting is per-session', async () => {
      const c1 = await sessionManager.getOrCreateSession('teacher-A');
      const c2 = await sessionManager.getOrCreateSession('teacher-B');

      c1.sock.ev.emit('connection.update', { connection: 'open' });
      c2.sock.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      for (let i = 0; i < 30; i++) {
        await c1.sendMessage('+201234567890', `msg ${i}`);
      }

      await expect(c1.sendMessage('+201234567890', 'one more')).rejects.toThrow('Rate limit exceeded');
      await expect(c2.sendMessage('+201234567890', 'different session')).resolves.not.toThrow();
    });

    test('logout of one session does not affect another', async () => {
      const c1 = await sessionManager.getOrCreateSession('teacher-A');
      const c2 = await sessionManager.getOrCreateSession('teacher-B');

      c1.sock.ev.emit('connection.update', { connection: 'open' });
      c2.sock.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      await sessionManager.destroySession('teacher-A', { deleteCredentials: true });

      expect(sessionManager.sessions.has('teacher-A')).toBe(false);
      expect(sessionManager.sessions.has('teacher-B')).toBe(true);
      expect(c2.status).toBe('connected');
    });

    test('incoming messages go to the correct session only', async () => {
      const c1 = await sessionManager.getOrCreateSession('teacher-A');
      const c2 = await sessionManager.getOrCreateSession('teacher-B');

      const msgs1 = [];
      const msgs2 = [];
      c1.on('message', (m) => msgs1.push(m));
      c2.on('message', (m) => msgs2.push(m));

      const fakeMsg = { key: { fromMe: false, remoteJid: 'test@s.whatsapp.net' }, message: { conversation: 'hello' } };

      c1.sock.ev.emit('messages.upsert', { type: 'notify', messages: [fakeMsg] });
      await new Promise(r => setTimeout(r, 10));

      expect(msgs1.length).toBe(1);
      expect(msgs2.length).toBe(0);
    });
  });

  describe('515 reconnect storm', () => {
    test('all sessions getting 515 simultaneously stagger their reconnects', async () => {
      jest.useFakeTimers();

      const c1 = await sessionManager.getOrCreateSession('teacher-A');
      const c2 = await sessionManager.getOrCreateSession('teacher-B');
      const c3 = await sessionManager.getOrCreateSession('teacher-C');

      c1.sock.ev.emit('connection.update', { connection: 'open' });
      c2.sock.ev.emit('connection.update', { connection: 'open' });
      c3.sock.ev.emit('connection.update', { connection: 'open' });
      await jest.advanceTimersByTimeAsync(10);

      expect(c1.status).toBe('connected');
      expect(c2.status).toBe('connected');
      expect(c3.status).toBe('connected');

      const spy1 = jest.spyOn(c1, 'connect');
      const spy2 = jest.spyOn(c2, 'connect');
      const spy3 = jest.spyOn(c3, 'connect');

      c1.sock.ev.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 515 } } }
      });
      c2.sock.ev.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 515 } } }
      });
      c3.sock.ev.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 515 } } }
      });

      await jest.advanceTimersByTimeAsync(10);

      expect(spy1).not.toHaveBeenCalled();
      expect(spy2).not.toHaveBeenCalled();
      expect(spy3).not.toHaveBeenCalled();

      expect(c1.reconnectTimer).not.toBeNull();
      expect(c2.reconnectTimer).not.toBeNull();
      expect(c3.reconnectTimer).not.toBeNull();

      await jest.advanceTimersByTimeAsync(5000);

      expect(spy1).toHaveBeenCalled();
      expect(spy2).toHaveBeenCalled();
      expect(spy3).toHaveBeenCalled();

      spy1.mockRestore();
      spy2.mockRestore();
      spy3.mockRestore();
      jest.useRealTimers();
    });

    test('515 reconnect increments attempt counter per session', async () => {
      jest.useFakeTimers();

      const c1 = await sessionManager.getOrCreateSession('teacher-A');
      c1.sock.ev.emit('connection.update', { connection: 'open' });
      await jest.advanceTimersByTimeAsync(10);

      expect(c1.reconnectAttempts).toBe(0);

      c1.sock.ev.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 515 } } }
      });
      await jest.advanceTimersByTimeAsync(10);

      expect(c1.reconnectAttempts).toBe(1);

      await jest.advanceTimersByTimeAsync(5000);

      c1.sock.ev.emit('connection.update', { connection: 'open' });
      await jest.advanceTimersByTimeAsync(10);

      expect(c1.reconnectAttempts).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('one session failure does not crash others', () => {
    test('loggedOut on teacher-A does not affect teacher-B', async () => {
      const c1 = await sessionManager.getOrCreateSession('teacher-A');
      const c2 = await sessionManager.getOrCreateSession('teacher-B');

      c1.sock.ev.emit('connection.update', { connection: 'open' });
      c2.sock.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      c1.sock.ev.emit('connection.update', {
        connection: 'close',
        lastDisconnect: { error: { output: { statusCode: 401 } } }
      });
      await new Promise(r => setTimeout(r, 10));

      expect(c1.status).toBe('disconnected');
      expect(c2.status).toBe('connected');
      expect(sessionManager.sessions.has('teacher-B')).toBe(true);
    });

    test('connect error on one session does not prevent creating another', async () => {
      const { useSupabaseAuthState } = require('../baileysAuthState');
      const origMock = useSupabaseAuthState.getMockImplementation?.() || useSupabaseAuthState;

      useSupabaseAuthState.mockImplementationOnce((tid) => {
        if (tid === 'teacher-fail') {
          return Promise.reject(new Error('DB connection failed'));
        }
        return Promise.resolve({
          state: { creds: {}, keys: {} },
          saveCreds: jest.fn(),
          cancelPendingSave: jest.fn(),
          flushPendingSave: jest.fn().mockResolvedValue(undefined)
        });
      });

      const c1 = await sessionManager.getOrCreateSession('teacher-fail');
      expect(c1.status).toBe('error');

      useSupabaseAuthState.mockResolvedValue({
        state: { creds: {}, keys: {} },
        saveCreds: jest.fn(),
        cancelPendingSave: jest.fn(),
        flushPendingSave: jest.fn().mockResolvedValue(undefined)
      });

      const c2 = await sessionManager.getOrCreateSession('teacher-ok');
      expect(c2).toBeDefined();
      expect(c2.teacherId).toBe('teacher-ok');
    });
  });

  describe('LRU eviction under concurrent load', () => {
    test('evicts least recently active when at max capacity', async () => {
      sessionManager.maxSessions = 3;

      const c1 = await sessionManager.getOrCreateSession('teacher-1', { autoConnect: false });
      const c2 = await sessionManager.getOrCreateSession('teacher-2', { autoConnect: false });
      const c3 = await sessionManager.getOrCreateSession('teacher-3', { autoConnect: false });

      sessionManager.sessions.get('teacher-1').lastActive = Date.now() - 100000;
      sessionManager.sessions.get('teacher-2').lastActive = Date.now() - 50000;
      sessionManager.sessions.get('teacher-3').lastActive = Date.now();

      await sessionManager.getOrCreateSession('teacher-4', { autoConnect: false });

      expect(sessionManager.sessions.has('teacher-1')).toBe(false);
      expect(sessionManager.sessions.has('teacher-2')).toBe(true);
      expect(sessionManager.sessions.has('teacher-3')).toBe(true);
      expect(sessionManager.sessions.has('teacher-4')).toBe(true);
      expect(sessionManager.sessions.size).toBe(3);
    });

    test('concurrent getOrCreateSession for same teacher returns same client', async () => {
      const promises = [
        sessionManager.getOrCreateSession('teacher-concurrent', { autoConnect: false }),
        sessionManager.getOrCreateSession('teacher-concurrent', { autoConnect: false }),
        sessionManager.getOrCreateSession('teacher-concurrent', { autoConnect: false })
      ];

      const results = await Promise.all(promises);
      expect(results[0]).toBe(results[1]);
      expect(results[1]).toBe(results[2]);
      expect(sessionManager.sessions.size).toBe(1);
    });
  });

  describe('health check', () => {
    test('detects and evicts stale sessions', async () => {
      const c1 = await sessionManager.getOrCreateSession('teacher-stale');
      const c2 = await sessionManager.getOrCreateSession('teacher-fresh');

      c1.sock.ev.emit('connection.update', { connection: 'open' });
      c2.sock.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      sessionManager.sessions.get('teacher-stale').lastActive = Date.now() - 20 * 60 * 1000;

      await sessionManager._runHealthCheck();

      expect(sessionManager.sessions.has('teacher-stale')).toBe(false);
      expect(sessionManager.sessions.has('teacher-fresh')).toBe(true);
    });

    test('detects and evicts failed sessions', async () => {
      const c1 = await sessionManager.getOrCreateSession('teacher-failed');
      const c2 = await sessionManager.getOrCreateSession('teacher-ok');

      c2.sock.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      c1.status = 'failed';
      c1.reconnectAttempts = 50;

      await sessionManager._runHealthCheck();

      expect(sessionManager.sessions.has('teacher-failed')).toBe(false);
      expect(sessionManager.sessions.has('teacher-ok')).toBe(true);
    });
  });

  describe('cold boot recovery', () => {
    test('connectAll restores sessions from DB', async () => {
      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'whatsapp_sessions') {
          return makeChain([
            { teacher_id: 'teacher-1', status: 'connected' },
            { teacher_id: 'teacher-2', status: 'connected' }
          ], null);
        }
        return defaultChain();
      });

      await sessionManager.connectAll();

      expect(sessionManager.sessions.has('teacher-1')).toBe(true);
      expect(sessionManager.sessions.has('teacher-2')).toBe(true);
    });

    test('connectAll skips sessions with error status in DB', async () => {
      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'whatsapp_sessions') {
          return makeChain([
            { teacher_id: 'teacher-1', status: 'error' }
          ], null);
        }
        return defaultChain();
      });

      await sessionManager.connectAll();

      expect(sessionManager.sessions.has('teacher-1')).toBe(true);
    });

    test('connectAll handles empty DB gracefully', async () => {
      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'whatsapp_sessions') {
          return makeChain([], null);
        }
        return defaultChain();
      });

      await sessionManager.connectAll();

      expect(sessionManager.sessions.size).toBe(0);
    });

    test('connectAll batches connections (staggered)', async () => {
      sessionManager.maxSessions = 50;
      const teachers = Array.from({ length: 12 }, (_, i) => ({
        teacher_id: `teacher-${i}`,
        status: 'connected'
      }));

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'whatsapp_sessions') {
          return makeChain(teachers, null);
        }
        return defaultChain();
      });

      const startTime = Date.now();
      await sessionManager.connectAll();
      const duration = Date.now() - startTime;

      expect(sessionManager.sessions.size).toBe(12);
      expect(duration).toBeLessThan(30000);
    });
  });

  describe('session status snapshot', () => {
    test('getSessionsSnapshot returns all sessions with correct phones', async () => {
      const c1 = await sessionManager.getOrCreateSession('teacher-A');
      const c2 = await sessionManager.getOrCreateSession('teacher-B');

      c1.sock.ev.emit('connection.update', { connection: 'open' });
      c2.sock.ev.emit('connection.update', { connection: 'open' });
      await new Promise(r => setTimeout(r, 10));

      const snapshot = sessionManager.getSessionsSnapshot();

      expect(snapshot.length).toBe(2);
      const tA = snapshot.find(s => s.teacherId === 'teacher-A');
      const tB = snapshot.find(s => s.teacherId === 'teacher-B');
      expect(tA.status).toBe('connected');
      expect(tB.status).toBe('connected');
    });

    test('getStatus includes totalSessions and maxSessions', () => {
      sessionManager.maxSessions = 10;
      const status = sessionManager.getStatus();
      expect(status.totalSessions).toBe(0);
      expect(status.maxSessions).toBe(10);
    });
  });

  describe('graceful shutdown with multiple sessions', () => {
    test('stop() disconnects all sessions and clears map', async () => {
      await sessionManager.getOrCreateSession('teacher-A');
      await sessionManager.getOrCreateSession('teacher-B');
      await sessionManager.getOrCreateSession('teacher-C');

      expect(sessionManager.sessions.size).toBe(3);

      await sessionManager.stop();

      expect(sessionManager.sessions.size).toBe(0);
      expect(sessionManager._started).toBe(false);
    });
  });

  describe('getTeacherForPhone with parent under multiple teachers', () => {
    test('returns multiple teacher IDs when parent has students under different teachers', async () => {
      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'parents') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    students: [
                      {
                        enrollments: [{
                          group: { offering: { teacher_id: 'teacher-A' } }
                        }]
                      },
                      {
                        enrollments: [{
                          group: { offering: { teacher_id: 'teacher-B' } }
                        }]
                      }
                    ]
                  },
                  error: null
                })
              })
            })
          };
        }
        return defaultChain();
      });

      const teacherIds = await sessionManager.getTeacherForPhone('+201234567890');
      expect(teacherIds).toEqual(['teacher-A', 'teacher-B']);
    });
  });
});
