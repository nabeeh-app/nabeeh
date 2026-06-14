const express = require('express');
const supabase = require('../config/database').supabaseAdmin;
const { authenticateToken } = require('../middleware/auth');
const logger = require('../lib/logger');

const router = express.Router();

// @desc    Get conversations and messages
// @route   GET /api/messages/conversations
// @access  Private
const getConversations = async (req, res) => {
  try {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        parents (
          name,
          phone,
          preferred_language,
          students (name, student_id)
        )
      `)
      .eq('teacher_id', req.user.id)
      .order('last_message_at', { ascending: false });

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      data: conversations
    });
  } catch (error) {
    logger.error('Get conversations error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error fetching conversations'
    });
  }
};

// @desc    Get messages for a conversation
// @route   GET /api/messages/conversations/:id
// @access  Private
const getConversationMessages = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Verify conversation belongs to teacher
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', req.params.id)
      .eq('teacher_id', req.user.id)
      .single();

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', req.params.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    const { count: total } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', req.params.id);

    const totalPages = Math.ceil((total || 0) / limit);

    res.status(200).json({
      success: true,
      data: messages.reverse(), // Show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total || 0,
        pages: totalPages
      }
    });
  } catch (error) {
    logger.error('Get conversation messages error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error fetching messages'
    });
  }
};

// Message sending is handled by WhatsApp routes - this endpoint is deprecated

// @desc    Get message statistics
// @route   GET /api/messages/stats
// @access  Private
const getMessageStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = end_date || new Date().toISOString();

    // Single RPC call replaces 3 separate count queries
    const { data: statsRow, error: rpcError } = await supabase
      .rpc('message_stats', {
        p_teacher_id: req.user.id,
        p_start_date: startDate,
        p_end_date: endDate
      })
      .single();

    if (rpcError) throw rpcError;

    const totalMessages = Number(statsRow.total_count) || 0;
    const incomingMessages = Number(statsRow.incoming_count) || 0;
    const automatedMessages = Number(statsRow.automated_count) || 0;

    // Get most common intents (still needs separate query for grouped data)
    const { data: intents } = await supabase
      .from('messages')
      .select(`
        intent,
        conversations!inner (teacher_id)
      `)
      .eq('conversations.teacher_id', req.user.id)
      .not('intent', 'is', null)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const intentCounts = {};
    intents?.forEach(msg => {
      intentCounts[msg.intent] = (intentCounts[msg.intent] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        total_messages: totalMessages,
        incoming_messages: incomingMessages,
        outgoing_messages: totalMessages - incomingMessages,
        automated_messages: automatedMessages,
        manual_messages: totalMessages - automatedMessages,
        common_intents: intentCounts,
        period: { start_date: startDate, end_date: endDate }
      }
    });
  } catch (error) {
    logger.error('Get message stats error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Server error fetching message statistics'
    });
  }
};

// Route definitions
/**
 * @openapi
 * /api/messages/conversations:
 *   get:
 *     tags: [Messages]
 *     summary: List conversations
 *     description: Retrieve all WhatsApp conversations for the authenticated teacher, ordered by most recent message.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Database query error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/conversations', authenticateToken, getConversations);
/**
 * @openapi
 * /api/messages/conversations/{id}:
 *   get:
 *     tags: [Messages]
 *     summary: Get conversation messages
 *     description: Retrieve paginated messages for a specific conversation. Messages are returned oldest-first.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Conversation ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     pages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Conversation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/conversations/:id', authenticateToken, getConversationMessages);
// router.post('/send', authenticateToken, sendMessage); // Deprecated - use WhatsApp routes
/**
 * @openapi
 * /api/messages/stats:
 *   get:
 *     tags: [Messages]
 *     summary: Message statistics
 *     description: Get message statistics for the authenticated teacher within a date range. Defaults to the last 7 days.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date (ISO 8601). Defaults to 7 days ago.
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date (ISO 8601). Defaults to now.
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_messages:
 *                       type: integer
 *                     incoming_messages:
 *                       type: integer
 *                     outgoing_messages:
 *                       type: integer
 *                     automated_messages:
 *                       type: integer
 *                     manual_messages:
 *                       type: integer
 *                     common_intents:
 *                       type: object
 *                     period:
 *                       type: object
 *                       properties:
 *                         start_date:
 *                           type: string
 *                         end_date:
 *                           type: string
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
router.get('/stats', authenticateToken, getMessageStats);

module.exports = router;
