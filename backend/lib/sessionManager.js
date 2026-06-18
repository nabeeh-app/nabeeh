const EventEmitter = require('events');
const logger = require('./logger');
const { supabaseAdmin } = require('../config/database');
const { BaileysClient } = require('./baileys');
const { normalizePhoneNumber } = require('./phone');

/**
 * Manages multiple WhatsApp sessions, one per teacher.
 * Each teacher gets an isolated BaileysClient with its own auth state.
 * 
 * Features:
 * - Dynamic session limit (configurable via env)
 * - Lazy session loading (connect on first message)
 * - Auto-disconnect after inactivity
 * - Memory monitoring
 * - Graceful shutdown
 */
class WhatsAppSessionManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Map<string, { client: BaileysClient, status: string, lastActive: number, createdAt: number }>} */
    this.sessions = new Map();
    this.maxSessions = parseInt(process.env.WHATSAPP_MAX_SESSIONS || '50', 10);
    this._started = false;
    this.pending = new Set();
    this._healthCheckInterval = null;
    this.HEALTH_CHECK_INTERVAL = 5 * 60 * 1000;
    this.STALE_SESSION_THRESHOLD = 15 * 60 * 1000;
  }

  /**
   * Start the session manager: connect existing sessions
   */
  async start() {
    if (this._started) return;
    this._started = true;

    // Connect all sessions from database
    await this.connectAll();

    // Start periodic health check
    this._startHealthCheck();

    logger.info('Session manager started', {
      maxSessions: this.maxSessions,
      activeSessions: this.sessions.size
    });
  }

  /**
   * Stop the session manager: disconnect all sessions
   */
  async stop() {
    const flushPromises = [];
    const disconnectPromises = [];

    for (const [teacherId, session] of this.sessions) {
      if (session.client._flushPendingSave) {
        flushPromises.push(
          session.client._flushPendingSave().catch(err =>
            logger.error('Error flushing creds on shutdown', { teacherId, error: err.message })
          )
        );
      }
      disconnectPromises.push(
        session.client.disconnect().catch(err =>
          logger.error('Error disconnecting session on shutdown', { teacherId, error: err.message })
        )
      );
    }

    await Promise.allSettled(flushPromises);
    await Promise.allSettled(disconnectPromises);
    this.sessions.clear();
    this._stopHealthCheck();
    this._started = false;
    logger.info('Session manager stopped');
  }

  /**
   * Create or get a session for a teacher
   * @param {string} teacherId
   * @param {object} [options]
   * @param {boolean} [options.autoConnect=true] - Auto-connect if not connected
   * @returns {Promise<BaileysClient>}
   */
  async getOrCreateSession(teacherId, { autoConnect = true } = {}) {
    if (this.sessions.has(teacherId)) {
      const session = this.sessions.get(teacherId);
      session.lastActive = Date.now();
      return session.client;
    }

    // Wait if another request is already creating this session
    if (this.pending.has(teacherId)) {
      // Poll until session appears or timeout
      const start = Date.now();
      while (!this.sessions.has(teacherId) && Date.now() - start < 10000) {
        await new Promise(r => setTimeout(r, 50));
      }
      if (this.sessions.has(teacherId)) {
        return this.sessions.get(teacherId).client;
      }
      // Timeout — fall through to create
    }

    this.pending.add(teacherId);
    try {
      // Check session limit
      if (this.sessions.size >= this.maxSessions) {
        const evicted = await this._evictInactiveSession();
        if (!evicted) {
          throw new Error(`Maximum concurrent sessions reached (${this.maxSessions}). Disconnect a session first.`);
        }
      }

      const client = new BaileysClient(teacherId);
      this.sessions.set(teacherId, {
        client,
        status: 'disconnected',
        lastActive: Date.now(),
        createdAt: Date.now()
      });

      // Update database
      await supabaseAdmin.from('whatsapp_sessions').upsert({
        teacher_id: teacherId,
        status: 'disconnected'
      }, { onConflict: 'teacher_id' });

      if (autoConnect) {
        await client.connect().catch(err => {
          logger.error('Failed to auto-connect session', { teacherId, error: err.message });
        });
      }

      // Track connection events from client
      client.on('connection.update', (update) => {
        const session = this.sessions.get(teacherId);
        if (session) {
          session.status = update.status;
          session.lastActive = Date.now();

          supabaseAdmin.from('whatsapp_sessions').update({
            status: update.status,
            phone: update.phone || null,
            last_active: new Date().toISOString(),
            ...(update.status === 'connected' ? { connected_at: new Date().toISOString() } : {}),
            ...(update.status === 'disconnected' ? { disconnected_at: new Date().toISOString() } : {})
          }).eq('teacher_id', teacherId)
            .then(() => {})
            .catch(err =>
              logger.error('Failed to update session status', { teacherId, error: err.message })
            );
        }
      });

      // Notify listeners (e.g., whatsapp.js message handler setup)
      this.emit('sessionCreated', { teacherId, client });

      logger.info('Session created', { teacherId, totalSessions: this.sessions.size });
      return client;
    } finally {
      this.pending.delete(teacherId);
    }
  }

  /**
   * Get an existing session (returns null if not found)
   * @param {string} teacherId
   * @returns {BaileysClient|null}
   */
  getSession(teacherId) {
    const session = this.sessions.get(teacherId);
    if (session) {
      session.lastActive = Date.now();
      return session.client;
    }
    return null;
  }

  /**
   * Destroy a session and clean up resources
   * @param {string} teacherId
   * @param {object} [options]
   * @param {boolean} [options.deleteCredentials=false] - If true, delete credentials (for explicit logout)
   */
  async destroySession(teacherId, { deleteCredentials = false } = {}) {
    const session = this.sessions.get(teacherId);
    if (!session) return;

    try {
      // Use disconnect() for timeout (keeps credentials for auto-reconnect)
      // Use logout() for explicit logout (deletes credentials)
      if (deleteCredentials) {
        await session.client.logout();
      } else {
        await session.client.disconnect();
      }
    } catch (err) {
      logger.warn('Error destroying session', { teacherId, error: err.message });
    }

    this.sessions.delete(teacherId);

    // Update database
    const { error: dbErr } = await supabaseAdmin.from('whatsapp_sessions').update({
      status: 'disconnected',
      disconnected_at: new Date().toISOString()
    }).eq('teacher_id', teacherId);
    if (dbErr) {
      logger.error('Failed to update session status on destroy', { teacherId, error: dbErr.message });
    }

    logger.info('Session destroyed', { teacherId, deleteCredentials, totalSessions: this.sessions.size });
  }

  /**
   * Connect all sessions from database on startup
   */
  async connectAll() {
    const { data: dbSessions, error } = await supabaseAdmin
      .from('whatsapp_sessions')
      .select('teacher_id, status')
      .in('status', ['connected', 'error']);

    if (error) {
      logger.error('Failed to load sessions from database', { error: error.message });
      return;
    }

    if (!dbSessions || dbSessions.length === 0) {
      logger.info('No existing sessions to restore');
      return;
    }

    logger.info('Restoring sessions from database', { count: dbSessions.length });

    // Stagger connections: connect in batches of 5 with 500ms between batches
    const BATCH_SIZE = 5;
    for (let i = 0; i < dbSessions.length; i += BATCH_SIZE) {
      const batch = dbSessions.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(({ teacher_id }) =>
          this.getOrCreateSession(teacher_id, { autoConnect: true }).catch(err => {
            logger.error('Failed to restore session', { teacherId: teacher_id, error: err.message });
          })
        )
      );
      // Wait between batches (not after the last batch)
      if (i + BATCH_SIZE < dbSessions.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  /**
   * Find which teacher(s) should handle a message from a phone number
   * @param {string} phone - Phone number (with or without +)
   * @returns {Promise<string[]|null>} array of teacherIds or null
   */
  async getTeacherForPhone(phone) {
    const cleanPhone = normalizePhoneNumber(phone);

    // Ensure it starts with country code (no leading zeros after country code)
    if (!cleanPhone.match(/^[1-9]\d+$/)) {
      // Invalid phone format
      return null;
    }

    const { data: parent, error } = await supabaseAdmin
      .from('parents')
      .select(`
        id,
        students (
          id,
          enrollments (
            id,
            group:groups (
              id,
              offering:offerings (
                id,
                teacher_id
              )
            )
          )
        )
      `)
      .eq('phone', `+${cleanPhone}`)
      .single();

    if (error || !parent) return null;

    const teacherIds = new Set();
    for (const student of parent.students || []) {
      for (const enrollment of student.enrollments || []) {
        const teacherId = enrollment?.group?.offering?.teacher_id;
        if (teacherId) teacherIds.add(teacherId);
      }
    }

    return teacherIds.size > 0 ? Array.from(teacherIds) : null;
  }

  /**
   * Get status of all sessions
   * @returns {object}
   */
  getStatus() {
    const status = {};
    for (const [teacherId, session] of this.sessions) {
      status[teacherId] = session.client.getStatus();
      status[teacherId].lastActive = new Date(session.lastActive).toISOString();
      status[teacherId].createdAt = new Date(session.createdAt).toISOString();
    }
    return {
      totalSessions: this.sessions.size,
      maxSessions: this.maxSessions,
      sessions: status
    };
  }

  /**
   * Get status for a specific teacher
   * @param {string} teacherId
   * @returns {object|null}
   */
  getTeacherStatus(teacherId) {
    const session = this.sessions.get(teacherId);
    if (!session) return null;
    return {
      ...session.client.getStatus(),
      lastActive: new Date(session.lastActive).toISOString(),
      createdAt: new Date(session.createdAt).toISOString()
    };
  }

  /**
   * Get a snapshot of all sessions (avoids exposing the raw Map)
   * @returns {Array<{teacherId: string, status: string, phone: string|null, lastActive: string|null}>}
   */
  getSessionsSnapshot() {
    return Array.from(this.sessions.entries()).map(([teacherId, session]) => {
      const s = session.client.getStatus();
      return {
        teacherId,
        status: s.status || 'disconnected',
        phone: s.phone || null,
        lastActive: session.lastActive ? new Date(session.lastActive).toISOString() : null
      };
    });
  }

  _startHealthCheck() {
    this._stopHealthCheck();
    this._healthCheckInterval = setInterval(() => this._runHealthCheck(), this.HEALTH_CHECK_INTERVAL);
    this._healthCheckInterval.unref();
  }

  _stopHealthCheck() {
    if (this._healthCheckInterval) {
      clearInterval(this._healthCheckInterval);
      this._healthCheckInterval = null;
    }
  }

  async _runHealthCheck() {
    const now = Date.now();
    const staleSessions = [];

    for (const [teacherId, session] of this.sessions) {
      const clientStatus = session.client.getStatus();
      const inMemoryStatus = clientStatus.status;

      if (inMemoryStatus === 'connected' && now - session.lastActive > this.STALE_SESSION_THRESHOLD) {
        logger.warn('Stale session detected by health check', { teacherId, lastActive: session.lastActive, staleMs: now - session.lastActive });
        staleSessions.push(teacherId);
      }

      if (inMemoryStatus === 'failed') {
        logger.warn('Failed session detected by health check, removing', { teacherId });
        staleSessions.push(teacherId);
      }
    }

    for (const teacherId of staleSessions) {
      try {
        await this.destroySession(teacherId);
        logger.info('Health check evicted stale session', { teacherId });
      } catch (err) {
        logger.error('Health check failed to evict session', { teacherId, error: err.message });
      }
    }

    if (this.sessions.size > 0) {
      const connected = Array.from(this.sessions.values()).filter(s => s.client.getStatus().status === 'connected').length;
      logger.info('Health check complete', { total: this.sessions.size, connected, evicted: staleSessions.length });
    }
  }

  /**
   * @returns {boolean} true if a session was evicted
   */
  async _evictInactiveSession() {
    if (this.sessions.size === 0) return false;

    // Find least recently active session
    let oldestTeacherId = null;
    let oldestTime = Date.now();

    for (const [teacherId, session] of this.sessions) {
      if (session.lastActive < oldestTime) {
        oldestTime = session.lastActive;
        oldestTeacherId = teacherId;
      }
    }

    if (oldestTeacherId) {
      logger.warn('Evicting inactive session to make room', { teacherId: oldestTeacherId });
      try {
        await this.destroySession(oldestTeacherId);
      } catch (err) {
        logger.error('Error evicting session', { teacherId: oldestTeacherId, error: err.message });
        return false;
      }
      return true;
    }

    return false;
  }
}

// Singleton instance
const sessionManager = new WhatsAppSessionManager();

module.exports = sessionManager;
