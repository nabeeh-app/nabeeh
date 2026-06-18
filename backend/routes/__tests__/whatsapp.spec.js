jest.mock('../../config/database', () => ({
  supabaseAdmin: {
    from: jest.fn()
  }
}));

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'teacher-1', email: 'test@example.com', role: 'teacher' };
    next();
  },
  requirePermission: jest.fn().mockReturnValue((req, res, next) => next())
}));

jest.mock('../../lib/sessionManager', () => ({
  on: jest.fn(),
  getSession: jest.fn().mockReturnValue({
    on: jest.fn(),
    getStatus: jest.fn().mockReturnValue({ status: 'connected', qr: null }),
    sendMessage: jest.fn().mockResolvedValue(true),
    startPairing: jest.fn().mockResolvedValue(true),
    logout: jest.fn().mockResolvedValue(true)
  }),
  getOrCreateSession: jest.fn().mockResolvedValue({
    on: jest.fn(),
    getStatus: jest.fn().mockReturnValue({ status: 'connected', qr: null }),
    sendMessage: jest.fn().mockResolvedValue(true),
    startPairing: jest.fn().mockResolvedValue(true),
    logout: jest.fn().mockResolvedValue(true)
  }),
  getTeacherStatus: jest.fn().mockReturnValue({ status: 'connected', qr: null }),
  destroySession: jest.fn().mockResolvedValue(true),
  getStatus: jest.fn().mockReturnValue({ totalSessions: 0, maxSessions: 50, sessions: {} }),
  sessions: new Map()
}));

jest.mock('../../lib/whatsappQuery', () => ({
  getParentByPhone: jest.fn(),
  findOrCreateConversation: jest.fn(),
  saveMessage: jest.fn(),
  getStudentAttendance: jest.fn(),
  getStudentGrades: jest.fn(),
  getMatchingFaq: jest.fn()
}));

jest.mock('../../lib/messageParser', () => ({
  detectIntent: jest.fn(),
  formatAttendanceResponse: jest.fn(),
  formatGradesResponse: jest.fn(),
  getHelpMessage: jest.fn()
}));

jest.mock('../../lib/aiResponder', () => ({
  generateResponse: jest.fn()
}));

jest.mock('../../lib/auditLog', () => ({
  logAudit: jest.fn().mockResolvedValue(true)
}));

const request = require('supertest');
const express = require('express');
const { router, normalizePhoneNumber } = require('../whatsapp');
const { supabaseAdmin } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/whatsapp', router);

describe('WhatsApp Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizePhoneNumber', () => {
    it('should normalize Egyptian local number', () => {
      expect(normalizePhoneNumber('01012345678')).toBe('201012345678');
    });

    it('should normalize Egyptian number with leading 0', () => {
      expect(normalizePhoneNumber('0221234567')).toBe('20221234567');
    });

    it('should keep Saudi number as-is', () => {
      expect(normalizePhoneNumber('966501234567')).toBe('966501234567');
    });

    it('should keep UAE number as-is', () => {
      expect(normalizePhoneNumber('971501234567')).toBe('971501234567');
    });

    it('should keep Kuwait number as-is', () => {
      expect(normalizePhoneNumber('965501234567')).toBe('965501234567');
    });

    it('should strip + prefix', () => {
      expect(normalizePhoneNumber('+201012345678')).toBe('201012345678');
    });

    it('should handle 00 prefix', () => {
      expect(normalizePhoneNumber('00201012345678')).toBe('201012345678');
    });

    it('should handle empty string', () => {
      expect(normalizePhoneNumber('')).toBe('');
    });

    it('should strip leading 0 after country code for Egyptian numbers', () => {
      expect(normalizePhoneNumber('+2001211310357')).toBe('201211310357');
    });
  });

  describe('POST /api/whatsapp/send-to-number', () => {
    it('should send message with valid phone and message', async () => {
      const res = await request(app)
        .post('/api/whatsapp/send-to-number')
        .send({ phone: '+201012345678', message: 'Hello' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject missing phone', async () => {
      const res = await request(app)
        .post('/api/whatsapp/send-to-number')
        .send({ message: 'Hello' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing message', async () => {
      const res = await request(app)
        .post('/api/whatsapp/send-to-number')
        .send({ phone: '+201012345678' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid phone format', async () => {
      const res = await request(app)
        .post('/api/whatsapp/send-to-number')
        .send({ phone: 'abc', message: 'Hello' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject message over 4096 chars', async () => {
      const longMessage = 'x'.repeat(4097);
      const res = await request(app)
        .post('/api/whatsapp/send-to-number')
        .send({ phone: '+201012345678', message: longMessage });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should accept message at exactly 4096 chars', async () => {
      const maxMessage = 'x'.repeat(4096);
      const res = await request(app)
        .post('/api/whatsapp/send-to-number')
        .send({ phone: '+201012345678', message: maxMessage });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 503 when WhatsApp is disconnected', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.getSession.mockReturnValue({
        getStatus: jest.fn().mockReturnValue({ status: 'disconnected', qr: null })
      });

      const res = await request(app)
        .post('/api/whatsapp/send-to-number')
        .send({ phone: '+201012345678', message: 'Hello' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/whatsapp/conversations', () => {
    it('should return conversations with pagination', async () => {
      const chainable = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [{ id: 'c1', teacher_id: 'teacher-1' }], error: null });
        })
      };

      const countChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ count: 1, error: null });
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(chainable);

      const res = await request(app).get('/api/whatsapp/conversations');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('should respect page and limit query params', async () => {
      const countChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ count: 50, error: null });
        })
      };

      const chainable = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [], error: null });
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(chainable);

      const res = await request(app)
        .get('/api/whatsapp/conversations')
        .query({ page: 2, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.limit).toBe(10);
    });

    it('should cap limit at 100', async () => {
      const countChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ count: 50, error: null });
        })
      };

      const chainable = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [], error: null });
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(chainable);

      const res = await request(app)
        .get('/api/whatsapp/conversations')
        .query({ limit: 999 });

      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(100);
    });
  });

  describe('GET /api/whatsapp/status', () => {
    it('should return status payload', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.getTeacherStatus.mockReturnValue({ status: 'connected', qr: null });

      const res = await request(app).get('/api/whatsapp/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('connected');
    });
  });

  describe('POST /api/whatsapp/bot/resume', () => {
    it('should resume bot for a conversation', async () => {
      const fetchChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'conv-1', teacher_id: 'teacher-1' },
          error: null
        })
      };

      const updateChain = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null })
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(fetchChain)
        .mockReturnValueOnce(updateChain);

      const res = await request(app)
        .post('/api/whatsapp/bot/resume')
        .send({ conversation_id: '12345678-1234-1234-8234-567812345678' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Bot resumed successfully');

      // Verify update was called with bot_paused_until: null
      expect(updateChain.update).toHaveBeenCalledWith({ bot_paused_until: null });
    });

    it('should return 400 for missing conversation_id', async () => {
      const res = await request(app)
        .post('/api/whatsapp/bot/resume')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 for non-existent conversation', async () => {
      const fetchChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      };

      supabaseAdmin.from.mockReturnValueOnce(fetchChain);

      const res = await request(app)
        .post('/api/whatsapp/bot/resume')
        .send({ conversation_id: 'aaaaaaaa-bbbb-1ccc-9ddd-eeeeeeeeeeee' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 if conversation belongs to another teacher', async () => {
      const fetchChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      };

      supabaseAdmin.from.mockReturnValueOnce(fetchChain);

      const res = await request(app)
        .post('/api/whatsapp/bot/resume')
        .send({ conversation_id: 'fedcba98-7654-3210-8654-3210fedcba98' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/whatsapp/sessions/:teacherId', () => {
    const VALID_UUID = 'aaaaaaaa-bbbb-1ccc-8ddd-eeeeeeeeeeee';

    it('should reject invalid teacherId UUID format', async () => {
      const res = await request(app)
        .delete('/api/whatsapp/sessions/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should disconnect session with valid UUID', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.destroySession.mockResolvedValueOnce(true);

      const res = await request(app)
        .delete(`/api/whatsapp/sessions/${VALID_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(sessionManager.destroySession).toHaveBeenCalledWith(
        VALID_UUID,
        { deleteCredentials: false }
      );
    });

    it('should force logout when ?force=true', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.destroySession.mockResolvedValueOnce(true);

      const res = await request(app)
        .delete(`/api/whatsapp/sessions/${VALID_UUID}?force=true`);

      expect(res.status).toBe(200);
      expect(sessionManager.destroySession).toHaveBeenCalledWith(
        VALID_UUID,
        { deleteCredentials: true }
      );
      expect(res.body.message).toBe('Session logged out');
    });

    it('should handle destroySession throwing an error', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.destroySession.mockRejectedValueOnce(new Error('DB failure'));

      const res = await request(app)
        .delete(`/api/whatsapp/sessions/${VALID_UUID}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/whatsapp/pair', () => {
    it('should start pairing session', async () => {
      const sessionManager = require('../../lib/sessionManager');
      const mockClient = {
        startPairing: jest.fn().mockResolvedValue(true),
        getStatus: jest.fn().mockReturnValue({ status: 'qr_ready', qr: 'data:image/png;base64,abc', phone: null })
      };
      sessionManager.getOrCreateSession.mockResolvedValueOnce(mockClient);
      sessionManager.getTeacherStatus.mockReturnValue({ status: 'qr_ready', qr: 'data:image/png;base64,abc', phone: null });

      const res = await request(app)
        .post('/api/whatsapp/pair');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockClient.startPairing).toHaveBeenCalled();
    });

    it('should return 500 on pairing failure', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.getOrCreateSession.mockRejectedValueOnce(new Error('Max sessions reached'));

      const res = await request(app)
        .post('/api/whatsapp/pair');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/whatsapp/pair-code', () => {
    it('should reject invalid phone format', async () => {
      const res = await request(app)
        .post('/api/whatsapp/pair-code')
        .send({ phone: 'abc' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing phone', async () => {
      const res = await request(app)
        .post('/api/whatsapp/pair-code')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return pairing code on success', async () => {
      const sessionManager = require('../../lib/sessionManager');
      const mockClient = {
        pairingCodeMode: false,
        clearQrExpiryTimer: jest.fn(),
        logout: jest.fn().mockResolvedValue(true),
        connect: jest.fn().mockResolvedValue(true),
        waitForReady: jest.fn().mockResolvedValue(true),
        requestPairingCode: jest.fn().mockResolvedValue('ABC-123')
      };
      sessionManager.getOrCreateSession.mockResolvedValueOnce(mockClient);

      const res = await request(app)
        .post('/api/whatsapp/pair-code')
        .send({ phone: '+201012345678' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('ABC-123');
      expect(res.body.data.phone).toBe('201012345678');
    });

    it('should return 500 on pairing code failure', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.getOrCreateSession.mockRejectedValueOnce(new Error('Connection failed'));

      const res = await request(app)
        .post('/api/whatsapp/pair-code')
        .send({ phone: '+201012345678' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/whatsapp/qr', () => {
    it('should return QR code', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.getTeacherStatus.mockReturnValue({ status: 'qr_ready', qr: 'data:image/png;base64,abc' });

      const res = await request(app)
        .get('/api/whatsapp/qr');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.qr).toBe('data:image/png;base64,abc');
    });

    it('should return null qr when no session', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.getTeacherStatus.mockReturnValue(null);

      const res = await request(app)
        .get('/api/whatsapp/qr');

      expect(res.status).toBe(200);
      expect(res.body.data.qr).toBeNull();
    });
  });

  describe('POST /api/whatsapp/logout', () => {
    it('should logout successfully with active session', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.destroySession.mockResolvedValueOnce(true);

      const res = await request(app)
        .post('/api/whatsapp/logout');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(sessionManager.destroySession).toHaveBeenCalledWith('teacher-1', { deleteCredentials: true });
    });

    it('should handle logout when no session exists', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.destroySession.mockResolvedValueOnce(false);

      const res = await request(app)
        .post('/api/whatsapp/logout');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('No active session to logout');
    });
  });

  describe('GET /api/whatsapp/sessions', () => {
    it('should return all sessions for admin', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.getStatus.mockReturnValue({
        totalSessions: 2,
        maxSessions: 50,
        sessions: {
          'teacher-1': { status: 'connected', phone: '+201012345678' },
          'teacher-2': { status: 'disconnected', phone: null }
        }
      });

      const res = await request(app)
        .get('/api/whatsapp/sessions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.totalSessions).toBe(2);
    });
  });

  describe('POST /api/whatsapp/send-to-number - auto-pause and audit', () => {
    it('should auto-pause bot when parent found', async () => {
      const sessionManager = require('../../lib/sessionManager');
      const { supabaseAdmin } = require('../../config/database');

      sessionManager.getSession.mockReturnValue({
        on: jest.fn(),
        getStatus: jest.fn().mockReturnValue({ status: 'connected', qr: null }),
        sendMessage: jest.fn().mockResolvedValue(true)
      });

      // First chain: parent lookup
      const parentChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'parent-1' }, error: null })
      };
      // Second chain: conversation lookup
      const convChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'conv-1' }, error: null })
      };
      // Third chain: update
      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(parentChain)
        .mockReturnValueOnce(convChain)
        .mockReturnValueOnce(updateChain);

      const res = await request(app)
        .post('/api/whatsapp/send-to-number')
        .send({ phone: '+201012345678', message: 'Hello' });

      expect(res.status).toBe(200);
      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ bot_paused_until: expect.any(String) })
      );
    });

    it('should handle auto-pause failure gracefully', async () => {
      const sessionManager = require('../../lib/sessionManager');
      const { supabaseAdmin } = require('../../config/database');

      sessionManager.getSession.mockReturnValue({
        on: jest.fn(),
        getStatus: jest.fn().mockReturnValue({ status: 'connected', qr: null }),
        sendMessage: jest.fn().mockResolvedValue(true)
      });

      // Parent lookup throws
      supabaseAdmin.from.mockImplementation(() => {
        throw new Error('DB error');
      });

      const res = await request(app)
        .post('/api/whatsapp/send-to-number')
        .send({ phone: '+201012345678', message: 'Hello' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 503 when session is null (no session at all)', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.getSession.mockReturnValueOnce(null);

      const res = await request(app)
        .post('/api/whatsapp/send-to-number')
        .send({ phone: '+201012345678', message: 'Hello' });

      expect(res.status).toBe(503);
      expect(res.body.message).toContain('No WhatsApp session found');
    });
  });

  describe('GET /api/whatsapp/conversations - error paths', () => {
    it('should return 500 on DB error', async () => {
      const { supabaseAdmin } = require('../../config/database');
      supabaseAdmin.from.mockImplementation(() => {
        throw new Error('DB failure');
      });

      const res = await request(app)
        .get('/api/whatsapp/conversations');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should handle empty conversations', async () => {
      const { supabaseAdmin } = require('../../config/database');
      supabaseAdmin.from.mockReset();

      const countChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ count: 0, error: null });
        })
      };
      const dataChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [], error: null });
        })
      };
      supabaseAdmin.from
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(dataChain);

      const res = await request(app)
        .get('/api/whatsapp/conversations');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });
  });

  describe('GET /api/whatsapp/status - edge cases', () => {
    it('should return qr_ready status', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.getTeacherStatus.mockReturnValue({ status: 'qr_ready', qr: 'data:image/png;base64,abc' });

      const res = await request(app).get('/api/whatsapp/status');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('qr_ready');
      expect(res.body.message).toContain('Scan the QR code');
    });

    it('should return connecting status', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.getTeacherStatus.mockReturnValue({ status: 'connecting', qr: null });

      const res = await request(app).get('/api/whatsapp/status');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('connecting');
      expect(res.body.message).toContain('Connecting');
    });

    it('should return disconnected status when no session', async () => {
      const sessionManager = require('../../lib/sessionManager');
      sessionManager.getTeacherStatus.mockReturnValue(null);

      const res = await request(app).get('/api/whatsapp/status');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('disconnected');
    });
  });
});
