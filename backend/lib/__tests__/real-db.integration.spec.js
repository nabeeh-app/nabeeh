/**
 * Real DB integration tests — runs against actual Supabase.
 * Uses existing teachers (FK to auth.users prevents temp creation).
 *
 * Run: npx jest lib/__tests__/real-db.integration.spec.js --forceExit --no-cache
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

let supabaseAdmin;
const T1 = '0b8d8f5e-8053-4229-9435-261ef9f12ade';
const T2 = '6e4d2e23-7cf9-4a82-9335-33c835728b89';

beforeAll(() => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
});

afterAll(async () => {
  await supabaseAdmin.from('whatsapp_sessions').delete().in('teacher_id', [T1, T2]);
  await supabaseAdmin.from('whatsapp_auth_keys').delete().in('teacher_id', [T1, T2]);
  // creds PK is just id — clean by teacher_id
  await supabaseAdmin.from('whatsapp_auth_creds').delete().eq('teacher_id', T1);
  await supabaseAdmin.from('whatsapp_auth_creds').delete().eq('teacher_id', T2);
});

// ============================================================
// whatsapp_sessions table
// ============================================================
describe('Real DB — whatsapp_sessions', () => {
  afterEach(async () => {
    await supabaseAdmin.from('whatsapp_sessions').delete().eq('teacher_id', T1);
  });

  it('should insert and read a session record', async () => {
    const { error } = await supabaseAdmin.from('whatsapp_sessions').insert({
      teacher_id: T1, status: 'connected', phone: '+201012345678',
      last_active: new Date().toISOString()
    });
    expect(error).toBeNull();

    const { data } = await supabaseAdmin.from('whatsapp_sessions')
      .select('*').eq('teacher_id', T1).single();

    expect(data.status).toBe('connected');
    expect(data.phone).toBe('+201012345678');
    expect(data.teacher_id).toBe(T1);
    expect(data.created_at).toBeDefined();
    expect(data.updated_at).toBeDefined();
  });

  it('should enforce UNIQUE constraint on teacher_id', async () => {
    await supabaseAdmin.from('whatsapp_sessions').insert({
      teacher_id: T1, status: 'disconnected'
    });
    const { error } = await supabaseAdmin.from('whatsapp_sessions').insert({
      teacher_id: T1, status: 'connected'
    });
    expect(error).not.toBeNull();
    expect(error.message).toContain('duplicate');
  });

  it('should enforce CHECK constraint on status', async () => {
    const { error } = await supabaseAdmin.from('whatsapp_sessions').insert({
      teacher_id: T1, status: 'invalid_status'
    });
    expect(error).not.toBeNull();
  });

  it('should auto-update updated_at on change', async () => {
    await supabaseAdmin.from('whatsapp_sessions').insert({
      teacher_id: T1, status: 'disconnected'
    });
    const { data: before } = await supabaseAdmin.from('whatsapp_sessions')
      .select('updated_at').eq('teacher_id', T1).single();

    await new Promise(r => setTimeout(r, 100));
    await supabaseAdmin.from('whatsapp_sessions')
      .update({ status: 'connected' }).eq('teacher_id', T1);

    const { data: after } = await supabaseAdmin.from('whatsapp_sessions')
      .select('updated_at').eq('teacher_id', T1).single();
    expect(new Date(after.updated_at).getTime()).toBeGreaterThan(
      new Date(before.updated_at).getTime()
    );
  });

  it('should accept all valid status values', async () => {
    for (const status of ['disconnected', 'qr_pending', 'pairing', 'connected', 'error']) {
      await supabaseAdmin.from('whatsapp_sessions').delete().eq('teacher_id', T1);
      const { error } = await supabaseAdmin.from('whatsapp_sessions').insert({
        teacher_id: T1, status
      });
      expect(error).toBeNull();
    }
  });

  it('should upsert session (onConflict teacher_id)', async () => {
    await supabaseAdmin.from('whatsapp_sessions').upsert({
      teacher_id: T1, status: 'disconnected'
    }, { onConflict: 'teacher_id' });

    await supabaseAdmin.from('whatsapp_sessions').upsert({
      teacher_id: T1, status: 'connected', phone: '+201099999999'
    }, { onConflict: 'teacher_id' });

    const { data } = await supabaseAdmin.from('whatsapp_sessions')
      .select('*').eq('teacher_id', T1);
    expect(data.length).toBe(1);
    expect(data[0].status).toBe('connected');
  });
});

// ============================================================
// whatsapp_auth_keys — schema: (type TEXT, id TEXT, data JSONB, teacher_id UUID)
// PK after migration 016: (type, id, teacher_id)
// ============================================================
describe('Real DB — whatsapp_auth_keys', () => {
  afterEach(async () => {
    await supabaseAdmin.from('whatsapp_auth_keys').delete().eq('teacher_id', T1);
  });

  it('should insert keys with teacher_id', async () => {
    const { error } = await supabaseAdmin.from('whatsapp_auth_keys').insert({
      type: 'app-state-sync-key', id: `test-key-${Date.now()}`,
      teacher_id: T1, data: JSON.stringify({ test: true })
    });
    expect(error).toBeNull();
  });

  it('should enforce PK (type, id, teacher_id) — duplicate rejected', async () => {
    const keyId = `test-dup-${Date.now()}`;
    await supabaseAdmin.from('whatsapp_auth_keys').insert({
      type: 'app-state-sync-key', id: keyId, teacher_id: T1, data: '{}'
    });
    const { error } = await supabaseAdmin.from('whatsapp_auth_keys').insert({
      type: 'app-state-sync-key', id: keyId, teacher_id: T1, data: '{}'
    });
    expect(error).not.toBeNull();
    expect(error.message).toContain('duplicate');
  });

  it('should allow same key type+id for different teachers', async () => {
    const keyId = `shared-key-${Date.now()}`;
    await supabaseAdmin.from('whatsapp_auth_keys').insert({
      type: 'app-state-sync-key', id: keyId, teacher_id: T1, data: '{"t":1}'
    });
    const { error } = await supabaseAdmin.from('whatsapp_auth_keys').insert({
      type: 'app-state-sync-key', id: keyId, teacher_id: T2, data: '{"t":2}'
    });
    expect(error).toBeNull();
    await supabaseAdmin.from('whatsapp_auth_keys').delete().eq('teacher_id', T2);
  });

  it('should delete keys by teacher_id', async () => {
    await supabaseAdmin.from('whatsapp_auth_keys').insert([
      { type: 'app-state-sync-key', id: `k1-${Date.now()}`, teacher_id: T1, data: '{}' },
      { type: 'sender-key', id: `k2-${Date.now()}`, teacher_id: T1, data: '{}' }
    ]);
    const { error } = await supabaseAdmin.from('whatsapp_auth_keys')
      .delete().eq('teacher_id', T1);
    expect(error).toBeNull();
    const { data } = await supabaseAdmin.from('whatsapp_auth_keys')
      .select('*').eq('teacher_id', T1);
    expect(data).toEqual([]);
  });

  it('should upsert keys without conflict', async () => {
    const keyId = `upsert-${Date.now()}`;
    await supabaseAdmin.from('whatsapp_auth_keys').upsert({
      type: 'app-state-sync-key', id: keyId, teacher_id: T1, data: '{"v":1}'
    }, { onConflict: 'type,id,teacher_id' });

    await supabaseAdmin.from('whatsapp_auth_keys').upsert({
      type: 'app-state-sync-key', id: keyId, teacher_id: T1, data: '{"v":2}'
    }, { onConflict: 'type,id,teacher_id' });

    const { data } = await supabaseAdmin.from('whatsapp_auth_keys')
      .select('data').eq('teacher_id', T1).eq('id', keyId).single();
    expect(data.data).toBe('{"v":2}');
  });
});

// ============================================================
// whatsapp_auth_creds — schema: (id TEXT PK, creds JSONB, teacher_id UUID)
// No unique constraint on (id, teacher_id) — PK is just (id)
// ============================================================
describe('Real DB — whatsapp_auth_creds', () => {
  afterEach(async () => {
    await supabaseAdmin.from('whatsapp_auth_creds').delete().eq('teacher_id', T1);
  });

  it('should insert creds with teacher_id', async () => {
    const { error } = await supabaseAdmin.from('whatsapp_auth_creds').insert({
      id: `creds-${Date.now()}`, teacher_id: T1,
      creds: JSON.stringify({ noiseKey: 'test' })
    });
    expect(error).toBeNull();
  });

  it('should update creds on conflict (id)', async () => {
    const credId = `cred-${Date.now()}`;
    await supabaseAdmin.from('whatsapp_auth_creds').insert({
      id: credId, teacher_id: T1, creds: '{"v":1}'
    });
    // Second insert with same id should update
    const { error } = await supabaseAdmin.from('whatsapp_auth_creds').upsert({
      id: credId, teacher_id: T1, creds: '{"v":2}'
    }, { onConflict: 'id' });
    expect(error).toBeNull();

    const { data } = await supabaseAdmin.from('whatsapp_auth_creds')
      .select('creds').eq('id', credId).single();
    expect(data.creds).toBe('{"v":2}');
  });

  it('should delete creds by teacher_id', async () => {
    await supabaseAdmin.from('whatsapp_auth_creds').insert({
      id: `del-${Date.now()}`, teacher_id: T1, creds: '{}'
    });
    const { error } = await supabaseAdmin.from('whatsapp_auth_creds')
      .delete().eq('teacher_id', T1);
    expect(error).toBeNull();
  });
});

// ============================================================
// whatsappQuery — real queries against real DB
// ============================================================
describe('Real DB — whatsappQuery', () => {
  const whatsappQuery = require('../whatsappQuery');

  it('getParentByPhone should query without error', async () => {
    const result = await whatsappQuery.getParentByPhone('+201012345678');
    if (result) expect(result).toHaveProperty('id');
  });

  it('getStudentAttendance should return null for fake student', async () => {
    const result = await whatsappQuery.getStudentAttendance('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('getAllStudentAttendance should return empty for fake student', async () => {
    const result = await whatsappQuery.getAllStudentAttendance('00000000-0000-0000-0000-000000000000');
    expect(result).toEqual([]);
  });

  it('getStudentGrades should return empty for fake student', async () => {
    const result = await whatsappQuery.getStudentGrades('00000000-0000-0000-0000-000000000000', null);
    expect(result.recentGrades).toEqual([]);
    expect(result.allGrades).toEqual([]);
  });

  it('getMatchingFaq should return null for fake teacher', async () => {
    const result = await whatsappQuery.getMatchingFaq('00000000-0000-0000-0000-000000000000', 'en', 'test');
    expect(result).toBeNull();
  });
});

// ============================================================
// Cross-table: full lifecycle simulation
// ============================================================
describe('Real DB — full session lifecycle', () => {
  afterEach(async () => {
    await supabaseAdmin.from('whatsapp_sessions').delete().eq('teacher_id', T1);
    await supabaseAdmin.from('whatsapp_auth_keys').delete().eq('teacher_id', T1);
    await supabaseAdmin.from('whatsapp_auth_creds').delete().eq('teacher_id', T1);
  });

  it('should simulate: create session → save creds → save keys → disconnect → cleanup', async () => {
    // 1. Create session
    await supabaseAdmin.from('whatsapp_sessions').upsert({
      teacher_id: T1, status: 'connected', phone: '+201012345678',
      connected_at: new Date().toISOString()
    }, { onConflict: 'teacher_id' });

    // 2. Save auth creds
    const credId = `lifecycle-${Date.now()}`;
    await supabaseAdmin.from('whatsapp_auth_creds').insert({
      id: credId, teacher_id: T1,
      creds: JSON.stringify({ noiseKey: 'abc', pairingCode: 'xyz' })
    });

    // 3. Save auth keys
    await supabaseAdmin.from('whatsapp_auth_keys').insert([
      { type: 'app-state-sync-key', id: 'key1', teacher_id: T1, data: '{}' },
      { type: 'sender-key', id: 'key2', teacher_id: T1, data: '{}' }
    ]);

    // 4. Verify all exist
    const { data: sess } = await supabaseAdmin.from('whatsapp_sessions')
      .select('*').eq('teacher_id', T1).single();
    expect(sess.status).toBe('connected');

    const { data: cred } = await supabaseAdmin.from('whatsapp_auth_creds')
      .select('*').eq('id', credId).single();
    expect(cred.creds).toContain('noiseKey');

    const { data: keys } = await supabaseAdmin.from('whatsapp_auth_keys')
      .select('*').eq('teacher_id', T1);
    expect(keys.length).toBe(2);

    // 5. Simulate disconnect
    await supabaseAdmin.from('whatsapp_sessions')
      .update({ status: 'disconnected', disconnected_at: new Date().toISOString() })
      .eq('teacher_id', T1);
    const { data: disc } = await supabaseAdmin.from('whatsapp_sessions')
      .select('status').eq('teacher_id', T1).single();
    expect(disc.status).toBe('disconnected');

    // 6. Simulate logout (delete all)
    await supabaseAdmin.from('whatsapp_auth_keys').delete().eq('teacher_id', T1);
    await supabaseAdmin.from('whatsapp_auth_creds').delete().eq('teacher_id', T1);
    await supabaseAdmin.from('whatsapp_sessions').delete().eq('teacher_id', T1);

    const { data: after } = await supabaseAdmin.from('whatsapp_sessions')
      .select('*').eq('teacher_id', T1);
    expect(after.length).toBe(0);
  });

  it('should verify multi-teacher isolation in DB', async () => {
    // T1: connected
    await supabaseAdmin.from('whatsapp_sessions').upsert({
      teacher_id: T1, status: 'connected', phone: '+20100000001'
    }, { onConflict: 'teacher_id' });

    // T2: disconnected
    await supabaseAdmin.from('whatsapp_sessions').upsert({
      teacher_id: T2, status: 'disconnected'
    }, { onConflict: 'teacher_id' });

    // T1 keys
    await supabaseAdmin.from('whatsapp_auth_keys').insert({
      type: 'app-state-sync-key', id: 't1key', teacher_id: T1, data: '{"t":1}'
    });

    // T2 keys
    await supabaseAdmin.from('whatsapp_auth_keys').insert({
      type: 'app-state-sync-key', id: 't2key', teacher_id: T2, data: '{"t":2}'
    });

    // Query T1
    const { data: sess1 } = await supabaseAdmin.from('whatsapp_sessions')
      .select('status, phone').eq('teacher_id', T1).single();
    expect(sess1.status).toBe('connected');
    expect(sess1.phone).toBe('+20100000001');

    const { data: keys1 } = await supabaseAdmin.from('whatsapp_auth_keys')
      .select('id, data').eq('teacher_id', T1);
    expect(keys1.length).toBe(1);
    expect(keys1[0].id).toBe('t1key');

    // Query T2
    const { data: sess2 } = await supabaseAdmin.from('whatsapp_sessions')
      .select('status').eq('teacher_id', T2).single();
    expect(sess2.status).toBe('disconnected');

    const { data: keys2 } = await supabaseAdmin.from('whatsapp_auth_keys')
      .select('id, data').eq('teacher_id', T2);
    expect(keys2.length).toBe(1);
    expect(keys2[0].id).toBe('t2key');

    // Cleanup
    await supabaseAdmin.from('whatsapp_sessions').delete().in('teacher_id', [T1, T2]);
    await supabaseAdmin.from('whatsapp_auth_keys').delete().in('teacher_id', [T1, T2]);
  });
});
