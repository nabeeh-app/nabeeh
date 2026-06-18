jest.mock('../../config/database', () => ({
  supabaseAdmin: {
    from: jest.fn()
  }
}));

jest.mock('../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('@whiskeysockets/baileys', () => ({
  initAuthCreds: jest.fn(() => ({ noiseKey: 'test-noise', signedIdentityKey: 'test-key' })),
  BufferJSON: {
    replacer: (k, v) => {
      if (Buffer.isBuffer(v) || v instanceof Uint8Array) {
        return { type: 'Buffer', data: Array.from(v) };
      }
      return v;
    },
    reviver: (k, v) => {
      if (typeof v === 'object' && v !== null && v.type === 'Buffer' && Array.isArray(v.data)) {
        return Buffer.from(v.data);
      }
      return v;
    }
  }
}));

const { supabaseAdmin } = require('../../config/database');
const { useSupabaseAuthState } = require('../baileysAuthState');

function makeChain(result) {
  const chain = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.neq = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockImplementation(() => Promise.resolve(result));
  chain.upsert = jest.fn().mockImplementation(() => Promise.resolve(result));
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.then = (resolve) => resolve(result);
  chain[Symbol.toStringTag] = 'Promise';
  return chain;
}

describe('baileysAuthState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useSupabaseAuthState — teacher-specific creds', () => {
    it('should load teacher-specific credentials when provided', async () => {
      const mockCreds = { noiseKey: 'teacher-noise', signedIdentityKey: 'teacher-key' };
      const chain = makeChain({ data: { creds: mockCreds }, error: null });
      supabaseAdmin.from.mockReturnValue(chain);

      const { state } = await useSupabaseAuthState('teacher-1');

      expect(state.creds).toEqual(mockCreds);
      expect(supabaseAdmin.from).toHaveBeenCalledWith('whatsapp_auth_creds');
      expect(chain.eq).toHaveBeenCalledWith('teacher_id', 'teacher-1');
    });

    it('should fallback to default creds when teacher not found', async () => {
      const defaultCreds = { noiseKey: 'default-noise', signedIdentityKey: 'default-key' };

      const teacherChain = makeChain({ data: null, error: null });
      const defaultChain = makeChain({ data: { creds: defaultCreds }, error: null });

      supabaseAdmin.from
        .mockReturnValueOnce(teacherChain)
        .mockReturnValueOnce(defaultChain);

      const { state } = await useSupabaseAuthState('teacher-1');

      expect(state.creds).toEqual(defaultCreds);
      expect(defaultChain.eq).toHaveBeenCalledWith('id', 'default');
    });

    it('should init new creds when no existing creds found', async () => {
      const chain = makeChain({ data: null, error: null });
      supabaseAdmin.from.mockReturnValue(chain);

      const { state } = await useSupabaseAuthState('teacher-new');

      expect(state.creds).toBeDefined();
      expect(state.creds.noiseKey).toBe('test-noise');
    });
  });

  describe('useSupabaseAuthState — no teacherId (default)', () => {
    it('should query with id=default when teacherId not provided', async () => {
      const chain = makeChain({ data: { creds: { noiseKey: 'd' } }, error: null });
      supabaseAdmin.from.mockReturnValue(chain);

      const { state } = await useSupabaseAuthState();

      expect(state.creds).toEqual({ noiseKey: 'd' });
      expect(chain.eq).toHaveBeenCalledWith('id', 'default');
    });
  });

  describe('keys.get', () => {
    it('should return decrypted key data for given type and ids', async () => {
      const keyData1 = { noiseKey: 'key-val' };
      const keyData2 = { encKey: 'enc-val' };

      const chain = makeChain({ data: [
        { id: 'key1', data: JSON.parse(JSON.stringify(keyData1)) },
        { id: 'key2', data: JSON.parse(JSON.stringify(keyData2)) }
      ], error: null });
      supabaseAdmin.from.mockReturnValue(chain);

      const { state } = await useSupabaseAuthState('teacher-1');
      const result = await state.keys.get('appStateSyncKey', ['key1', 'key2']);

      expect(result).toHaveProperty('key1');
      expect(result).toHaveProperty('key2');
      expect(result.key1).toEqual(keyData1);
      expect(result.key2).toEqual(keyData2);
    });

    it('should return empty object when ids array is empty', async () => {
      const chain = makeChain({ data: [], error: null });
      supabaseAdmin.from.mockReturnValue(chain);

      const { state } = await useSupabaseAuthState('teacher-1');
      const result = await state.keys.get('appStateSyncKey', []);

      expect(result).toEqual({});
    });

    it('should return empty object on query error', async () => {
      const chain = makeChain({ data: null, error: { message: 'db error' } });
      supabaseAdmin.from.mockReturnValue(chain);

      const { state } = await useSupabaseAuthState('teacher-1');
      const result = await state.keys.get('appStateSyncKey', ['key1']);

      expect(result).toEqual({});
    });

    it('should handle individual key reviver failures gracefully', async () => {
      const origFrom = Buffer.from;
      Buffer.from = jest.fn().mockImplementation(() => { throw new Error('deserialization failed'); });

      try {
        const chain = makeChain({ data: [
          { id: 'key1', data: { noiseKey: 'ok' } },
          { id: 'key2', data: { type: 'Buffer', data: [1, 2, 3] } }
        ], error: null });
        supabaseAdmin.from.mockReturnValue(chain);

        const logger = require('../logger');
        const { state } = await useSupabaseAuthState('teacher-1');
        const result = await state.keys.get('appStateSyncKey', ['key1', 'key2']);

        expect(result).toHaveProperty('key1');
        expect(result).not.toHaveProperty('key2');
        expect(logger.warn).toHaveBeenCalledWith('Auth key reviver failed', expect.objectContaining({ id: 'key2' }));
      } finally {
        Buffer.from = origFrom;
      }
    });
  });

  describe('keys.set', () => {
    it('should batch upsert records with correct structure', async () => {
      const initChain = makeChain({ data: { creds: { noiseKey: 'c' } }, error: null });
      const keysChain = makeChain({ error: null });
      supabaseAdmin.from
        .mockReturnValueOnce(initChain)
        .mockReturnValue(keysChain);

      const { state } = await useSupabaseAuthState('teacher-1');

      await state.keys.set({
        appStateSyncKey: {
          key1: { some: 'data' },
          key2: { other: 'data' }
        }
      });

      expect(keysChain.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ type: 'appStateSyncKey', id: 'key1', teacher_id: 'teacher-1' }),
          expect.objectContaining({ type: 'appStateSyncKey', id: 'key2', teacher_id: 'teacher-1' })
        ]),
        { onConflict: 'type,id,teacher_id' }
      );
    });

    it('should delete keys when value is null', async () => {
      const initChain = makeChain({ data: { creds: { noiseKey: 'c' } }, error: null });
      const keysChain = makeChain({ error: null });
      supabaseAdmin.from
        .mockReturnValueOnce(initChain)
        .mockReturnValue(keysChain);

      const { state } = await useSupabaseAuthState('teacher-1');

      await state.keys.set({
        appStateSyncKey: {
          key1: { some: 'data' },
          key2: null
        }
      });

      expect(keysChain.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'key1' })
        ]),
        { onConflict: 'type,id,teacher_id' }
      );
    });

    it('should not include teacher_id when teacherId is not provided', async () => {
      const initChain = makeChain({ data: { creds: { noiseKey: 'c' } }, error: null });
      const keysChain = makeChain({ error: null });
      supabaseAdmin.from
        .mockReturnValueOnce(initChain)
        .mockReturnValue(keysChain);

      const { state } = await useSupabaseAuthState();

      await state.keys.set({
        appStateSyncKey: { key1: { some: 'data' } }
      });

      const upsertArg = keysChain.upsert.mock.calls[0][0];
      expect(upsertArg[0]).not.toHaveProperty('teacher_id');
    });

    it('should skip empty id lists', async () => {
      const initChain = makeChain({ data: { creds: { noiseKey: 'c' } }, error: null });
      const keysChain = makeChain({ error: null });
      supabaseAdmin.from
        .mockReturnValueOnce(initChain)
        .mockReturnValue(keysChain);

      const { state } = await useSupabaseAuthState('teacher-1');

      await state.keys.set({
        appStateSyncKey: {}
      });

      expect(keysChain.upsert).not.toHaveBeenCalled();
      expect(keysChain.delete).not.toHaveBeenCalled();
    });
  });

  describe('keys.delete via set with null value', () => {
    it('should trigger delete when value is null', async () => {
      const initChain = makeChain({ data: { creds: { noiseKey: 'c' } }, error: null });
      const keysChain = makeChain({ error: null });
      supabaseAdmin.from
        .mockReturnValueOnce(initChain)
        .mockReturnValue(keysChain);

      const { state } = await useSupabaseAuthState('teacher-1');

      await state.keys.set({
        appStateSyncKey: {
          key1: null,
          key2: null
        }
      });

      expect(keysChain.delete).toHaveBeenCalled();
    });
  });

  describe('saveCreds', () => {
    it('should debounce credential saves', async () => {
      jest.useFakeTimers();

      const chain = makeChain({ error: null });
      supabaseAdmin.from.mockReturnValue(chain);

      const { state, saveCreds } = await useSupabaseAuthState('teacher-1');

      await saveCreds();
      await saveCreds();
      await saveCreds();

      expect(chain.upsert).not.toHaveBeenCalled();

      jest.advanceTimersByTime(3000);

      expect(chain.upsert).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it('should persist credentials with correct structure', async () => {
      jest.useFakeTimers();

      const chain = makeChain({ error: null });
      supabaseAdmin.from.mockReturnValue(chain);

      const { state, saveCreds } = await useSupabaseAuthState('teacher-1');
      await saveCreds();
      jest.advanceTimersByTime(3000);

      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          teacher_id: 'teacher-1',
          creds: expect.any(Object),
          updated_at: expect.any(String)
        }),
        { onConflict: 'teacher_id' }
      );
      jest.useRealTimers();
    });

    it('should use id=default when no teacherId', async () => {
      jest.useFakeTimers();

      const chain = makeChain({ error: null });
      supabaseAdmin.from.mockReturnValue(chain);

      const { state, saveCreds } = await useSupabaseAuthState();
      await saveCreds();
      jest.advanceTimersByTime(3000);

      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'default',
          creds: expect.any(Object),
          updated_at: expect.any(String)
        })
      );
      jest.useRealTimers();
    });
  });

  describe('flushPendingSave', () => {
    it('should immediately persist and clear timer', async () => {
      jest.useFakeTimers();

      const chain = makeChain({ error: null });
      supabaseAdmin.from.mockReturnValue(chain);

      const { state, saveCreds, flushPendingSave } = await useSupabaseAuthState('teacher-1');

      await saveCreds();
      await flushPendingSave();

      expect(chain.upsert).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(3000);

      expect(chain.upsert).toHaveBeenCalledTimes(1);
      jest.useRealTimers();
    });

    it('should do nothing when no pending save', async () => {
      const chain = makeChain({ error: null });
      supabaseAdmin.from.mockReturnValue(chain);

      const { state, flushPendingSave } = await useSupabaseAuthState('teacher-1');
      await flushPendingSave();

      expect(chain.upsert).not.toHaveBeenCalled();
    });
  });

  describe('cancelPendingSave', () => {
    it('should clear timer without persisting', async () => {
      jest.useFakeTimers();

      const chain = makeChain({ error: null });
      supabaseAdmin.from.mockReturnValue(chain);

      const { state, saveCreds, cancelPendingSave } = await useSupabaseAuthState('teacher-1');

      await saveCreds();
      cancelPendingSave();

      jest.advanceTimersByTime(5000);

      expect(chain.upsert).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('teacher scoping', () => {
    it('should include teacher_id in keys.get query', async () => {
      const chain = makeChain({ data: [], error: null });
      supabaseAdmin.from.mockReturnValue(chain);

      const { state } = await useSupabaseAuthState('teacher-1');
      await state.keys.get('appStateSyncKey', ['key1']);

      expect(chain.eq).toHaveBeenCalledWith('teacher_id', 'teacher-1');
    });

    it('should not add teacher_id filter when teacherId missing', async () => {
      const chain = makeChain({ data: [], error: null });
      supabaseAdmin.from.mockReturnValue(chain);

      const { state } = await useSupabaseAuthState();
      await state.keys.get('appStateSyncKey', ['key1']);

      const eqCalls = chain.eq.mock.calls.map(c => c[0]);
      expect(eqCalls).not.toContain('teacher_id');
    });
  });

  describe('saveCreds error handling', () => {
    it('should log error when teacher upsert fails', async () => {
      const logger = require('../logger');
      const errorChain = makeChain({ error: { message: 'duplicate', code: '23505' } });
      supabaseAdmin.from.mockReturnValue(errorChain);

      const { state, flushPendingSave, saveCreds } = await useSupabaseAuthState('teacher-1');

      jest.useFakeTimers();
      await saveCreds();
      await flushPendingSave();

      expect(logger.error).toHaveBeenCalledWith(
        'saveCreds FAILED (teacher)',
        expect.objectContaining({ teacherId: 'teacher-1' })
      );
      jest.useRealTimers();
    });

    it('should log error when default upsert fails', async () => {
      const logger = require('../logger');
      const errorChain = makeChain({ error: { message: 'fail', code: 'XX000' } });
      supabaseAdmin.from.mockReturnValue(errorChain);

      const { state, flushPendingSave, saveCreds } = await useSupabaseAuthState();

      jest.useFakeTimers();
      await saveCreds();
      await flushPendingSave();

      expect(logger.error).toHaveBeenCalledWith(
        'saveCreds FAILED (default)',
        expect.objectContaining({ error: 'fail', code: 'XX000' })
      );
      jest.useRealTimers();
    });
  });
});
