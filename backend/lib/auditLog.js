const { supabaseAdmin } = require('../config/database');
const logger = require('./logger');

const ACTOR_TYPES = ['teacher', 'assistant', 'system'];

/**
 * Log an audit event to action_audit_log
 * @param {Object} params
 * @param {string} params.actorId - ID of the user performing the action
 * @param {string} params.actorType - 'teacher' | 'assistant' | 'system'
 * @param {string} params.teacherId - Owner teacher ID (for assistants, this is the teacher they assist)
 * @param {string} params.action - Action performed (e.g. 'attendance_marked', 'grade_entered')
 * @param {string} params.entityType - Entity affected (e.g. 'attendance', 'grade', 'student')
 * @param {string} [params.entityId] - ID of the affected entity
 * @param {Object} [params.metadata] - Additional context
 * @param {string} [params.ipAddress] - Request IP address
 */
async function logAudit({ actorId, actorType, teacherId, action, entityType, entityId, metadata, ipAddress }) {
  try {
    if (!ACTOR_TYPES.includes(actorType)) {
      logger.warn('Invalid actorType for audit log', { actorType, action });
      actorType = 'system';
    }

    const { error } = await supabaseAdmin
      .from('action_audit_log')
      .insert([{
        actor_id: actorId,
        actor_type: actorType,
        teacher_id: teacherId,
        action,
        entity_type: entityType,
        entity_id: entityId || null,
        metadata: metadata || {},
        ip_address: ipAddress || null
      }]);

    if (error) {
      logger.error('Failed to write audit log', { error: error.message, action, entityType, entityId });
    }
  } catch (err) {
    logger.error('Audit log exception', { error: err.message, action, entityType, entityId });
  }
}

module.exports = { logAudit };
