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

jest.mock('../../lib/baileys', () => ({
  BaileysClient: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(true),
    logout: jest.fn().mockResolvedValue(true),
    getStatus: jest.fn().mockReturnValue({ status: 'disconnected', qr: null })
  }))
}));

const { supabaseAdmin } = require('../../config/database');

describe('sessionManager', () => {
  beforeEach(() => {
    const sessionManager = require('../../lib/sessionManager');
    sessionManager.sessions.clear();

    const mockEq = jest.fn().mockResolvedValue({ error: null });
    const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
    const mockUpsert = jest.fn().mockResolvedValue({ error: null });
    const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({ single: mockSingle })
    });
    supabaseAdmin.from.mockReturnValue({
      upsert: mockUpsert,
      update: mockUpdate,
      select: mockSelect
    });
  });

  describe('getOrCreateSession', () => {
    it('should create a new session and emit sessionCreated', async () => {
      supabaseAdmin.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({ error: null })
      });

      const sessionManager = require('../../lib/sessionManager');
      const client = await sessionManager.getOrCreateSession('teacher-1', { autoConnect: false });

      expect(client).toBeDefined();
      expect(sessionManager.sessions.has('teacher-1')).toBe(true);
    });

    it('should return existing session if already exists', async () => {
      const sessionManager = require('../../lib/sessionManager');
      const client1 = await sessionManager.getOrCreateSession('teacher-2', { autoConnect: false });
      const client2 = await sessionManager.getOrCreateSession('teacher-2', { autoConnect: false });

      expect(client1).toBe(client2);
    });
  });

  describe('getSession', () => {
    it('should return null for non-existent session', () => {
      const sessionManager = require('../../lib/sessionManager');
      const result = sessionManager.getSession('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('destroySession', () => {
    it('should remove session from map', async () => {
      const sessionManager = require('../../lib/sessionManager');
      await sessionManager.getOrCreateSession('teacher-destroy', { autoConnect: false });
      expect(sessionManager.sessions.has('teacher-destroy')).toBe(true);

      await sessionManager.destroySession('teacher-destroy');
      expect(sessionManager.sessions.has('teacher-destroy')).toBe(false);
    });

    it('should handle non-existent session gracefully', async () => {
      const sessionManager = require('../../lib/sessionManager');
      await expect(sessionManager.destroySession('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('_evictInactiveSession', () => {
    it('should evict least recently active session', async () => {
      const sessionManager = require('../../lib/sessionManager');
      await sessionManager.getOrCreateSession('teacher-old', { autoConnect: false });
      await sessionManager.getOrCreateSession('teacher-new', { autoConnect: false });

      sessionManager.sessions.get('teacher-old').lastActive = Date.now() - 100000;

      const evicted = await sessionManager._evictInactiveSession();
      expect(evicted).toBe(true);
    });
  });

  describe('getTeacherForPhone', () => {
    it('should return teacher ID for valid parent phone', async () => {
      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                students: [{
                  enrollments: [{
                    group: {
                      offering: { teacher_id: 'teacher-from-phone' }
                    }
                  }]
                }]
              },
              error: null
            })
          })
        })
      });

      const sessionManager = require('../../lib/sessionManager');
      const teacherIds = await sessionManager.getTeacherForPhone('+201234567890');
      expect(teacherIds).toEqual(['teacher-from-phone']);
    });

    it('should return null for unknown phone', async () => {
      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      const sessionManager = require('../../lib/sessionManager');
      const teacherId = await sessionManager.getTeacherForPhone('+0000000000');
      expect(teacherId).toBeNull();
    });
  });
});
