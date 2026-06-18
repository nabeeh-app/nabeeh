const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { supabaseAdmin } = require('../config/database');
const logger = require('./logger');

/**
 * Create Supabase-backed auth state scoped to a specific teacher.
 * Each teacher gets isolated credentials and keys.
 *
 * @param {string} [teacherId] - Teacher ID for multi-session support.
 *                                If not provided, falls back to 'default' for backward compatibility.
 * @returns {Promise<{state: {creds: object, keys: {get: Function, set: Function}}, saveCreds: Function, flushPendingSave: Function}>}
 */
async function useSupabaseAuthState(teacherId) {
  // Build query: prefer teacher-specific creds, fallback to 'default' for migration
  let credsRow = null;

  if (teacherId) {
    // Try teacher-specific creds first
    const { data, error } = await supabaseAdmin
      .from('whatsapp_auth_creds')
      .select('creds')
      .eq('teacher_id', teacherId)
      .single();

    if (!error && data) {
      credsRow = data;
    }
  }

  // Fallback to 'default' for backward compatibility
  if (!credsRow) {
    const { data, error } = await supabaseAdmin
      .from('whatsapp_auth_creds')
      .select('creds')
      .eq('id', 'default')
      .single();

    if (!error && data) {
      credsRow = data;
      logger.info('Loaded credentials from default session', { teacherId });
    }
  }

  const creds = credsRow?.creds
    ? JSON.parse(JSON.stringify(credsRow.creds), BufferJSON.reviver)
    : initAuthCreds();

  let saveCredsTimer = null;

  async function _persistCreds() {
    try {
      const serialized = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));

      if (teacherId) {
        const { error } = await supabaseAdmin
          .from('whatsapp_auth_creds')
          .upsert({
            teacher_id: teacherId,
            creds: serialized,
            updated_at: new Date().toISOString()
          }, { onConflict: 'teacher_id' });

        if (error) {
          logger.error('saveCreds FAILED (teacher)', { teacherId, error: error.message, code: error.code });
        } else {
          logger.info('saveCreds OK', { teacherId });
        }
      } else {
        const { error } = await supabaseAdmin
          .from('whatsapp_auth_creds')
          .upsert({
            id: 'default',
            creds: serialized,
            updated_at: new Date().toISOString()
          });

        if (error) {
          logger.error('saveCreds FAILED (default)', { error: error.message, code: error.code });
        } else {
          logger.info('saveCreds OK (default)');
        }
      }
    } catch (err) {
      logger.error('saveCreds ERROR', { teacherId, error: err.message });
    }
  }

  // Build a filter clause for teacher-scoped queries
  const buildFilter = (type, ids) => {
    const baseQuery = supabaseAdmin
      .from('whatsapp_auth_keys')
      .select('id, data')
      .eq('type', type)
      .in('id', ids);

    if (teacherId) {
      return baseQuery.eq('teacher_id', teacherId);
    }
    return baseQuery;
  };

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const results = {};
          if (!ids.length) return results;

          const { data: rows, error } = await buildFilter(type, ids);

          if (error) {
            logger.warn('Auth keys get failed', { type, teacherId, error: error.message });
            return results;
          }

          for (const row of (rows || [])) {
            try {
              results[row.id] = JSON.parse(JSON.stringify(row.data), BufferJSON.reviver);
            } catch (err) {
              logger.warn('Auth key reviver failed', { type, id: row.id, error: err.message });
            }
          }
          return results;
        },
        set: async (data) => {
          for (const type in data) {
            const ids = Object.keys(data[type]);
            if (!ids.length) continue;

            const toUpsert = [];
            const toDelete = [];

            for (const id of ids) {
              const value = data[type][id];
              if (value) {
                try {
                  const record = {
                    type,
                    id,
                    data: JSON.parse(JSON.stringify(value, BufferJSON.replacer))
                  };
                  // Add teacher_id if scoped
                  if (teacherId) {
                    record.teacher_id = teacherId;
                  }
                  toUpsert.push(record);
                } catch (err) {
                  logger.warn('Auth key serialize failed', { type, id, error: err.message });
                }
              } else {
                toDelete.push(id);
              }
            }

            if (toUpsert.length > 0) {
              const { error } = await supabaseAdmin
                .from('whatsapp_auth_keys')
                .upsert(toUpsert, { onConflict: 'type,id,teacher_id' });
              if (error) {
                logger.error('Auth keys batch upsert FAILED', { type, count: toUpsert.length, teacherId, error: error.message, code: error.code, details: error.details });
              } else {
                logger.info('Auth keys batch upsert OK', { type, count: toUpsert.length, teacherId });
              }
            }

            if (toDelete.length > 0) {
              let query = supabaseAdmin
                .from('whatsapp_auth_keys')
                .delete()
                .eq('type', type)
                .in('id', toDelete);

              if (teacherId) {
                query = query.eq('teacher_id', teacherId);
              }

              const { error } = await query;
              if (error) {
                logger.error('Auth keys batch delete FAILED', { type, count: toDelete.length, teacherId, error: error.message });
              }
            }
          }
        }
      }
    },
    saveCreds: async () => {
      // Debounce: coalesce rapid updates, only persist the last one within 3s
      if (saveCredsTimer) clearTimeout(saveCredsTimer);
      saveCredsTimer = setTimeout(async () => {
        saveCredsTimer = null;
        await _persistCreds();
      }, 3000);
    },
    flushPendingSave: async () => {
      if (saveCredsTimer) {
        clearTimeout(saveCredsTimer);
        saveCredsTimer = null;
        await _persistCreds();
      }
    }
  };
}

module.exports = { useSupabaseAuthState };
