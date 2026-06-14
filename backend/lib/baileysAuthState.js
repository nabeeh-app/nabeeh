const { initAuthCreds, BufferJSON } = require('@whiskeysockets/baileys');
const { supabaseAdmin } = require('../config/database');
const logger = require('./logger');

async function useSupabaseAuthState() {
  const { data: credsRow } = await supabaseAdmin
    .from('whatsapp_auth_creds')
    .select('creds')
    .eq('id', 'default')
    .single();

  const creds = credsRow?.creds ? JSON.parse(JSON.stringify(credsRow.creds), BufferJSON.reviver) : initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const results = {};
          if (!ids.length) return results;

          const { data: rows, error } = await supabaseAdmin
            .from('whatsapp_auth_keys')
            .select('id, data')
            .eq('type', type)
            .in('id', ids);

          if (error) {
            logger.warn('Auth keys get failed', { type, error: error.message });
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
                  toUpsert.push({
                    type,
                    id,
                    data: JSON.parse(JSON.stringify(value, BufferJSON.replacer))
                  });
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
                .upsert(toUpsert, { onConflict: 'type,id' });
              if (error) {
                logger.error('Auth keys batch upsert FAILED', { type, count: toUpsert.length, error: error.message, code: error.code, details: error.details });
              } else {
                logger.info('Auth keys batch upsert OK', { type, count: toUpsert.length });
              }
            }

            if (toDelete.length > 0) {
              const { error } = await supabaseAdmin
                .from('whatsapp_auth_keys')
                .delete()
                .eq('type', type)
                .in('id', toDelete);
              if (error) {
                logger.error('Auth keys batch delete FAILED', { type, count: toDelete.length, error: error.message });
              }
            }
          }
        }
      }
    },
    saveCreds: async () => {
      try {
        const serialized = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));
        const { error } = await supabaseAdmin
          .from('whatsapp_auth_creds')
          .upsert({
            id: 'default',
            creds: serialized,
            updated_at: new Date().toISOString()
          });
        if (error) {
          logger.error('saveCreds FAILED', { error: error.message, code: error.code });
        } else {
          logger.info('saveCreds OK');
        }
      } catch (err) {
        logger.error('saveCreds ERROR', { error: err.message });
      }
    }
  };
}

module.exports = { useSupabaseAuthState };
