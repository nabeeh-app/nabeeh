const express = require('express');
const { supabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

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
    console.error('Get conversations error:', error);
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

    res.status(200).json({
      success: true,
      data: messages.reverse(), // Show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Get conversation messages error:', error);
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

    // Get total messages
    const { count: totalMessages } = await supabase
      .from('messages')
      .select(`
        *,
        conversations!inner (teacher_id)
      `, { count: 'exact', head: true })
      .eq('conversations.teacher_id', req.user.id)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    // Get incoming vs outgoing
    const { count: incomingMessages } = await supabase
      .from('messages')
      .select(`
        *,
        conversations!inner (teacher_id)
      `, { count: 'exact', head: true })
      .eq('conversations.teacher_id', req.user.id)
      .eq('direction', 'incoming')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    // Get automated vs manual
    const { count: automatedMessages } = await supabase
      .from('messages')
      .select(`
        *,
        conversations!inner (teacher_id)
      `, { count: 'exact', head: true })
      .eq('conversations.teacher_id', req.user.id)
      .eq('is_automated', true)
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    // Get most common intents
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

    // Count intents
    const intentCounts = {};
    intents.forEach(msg => {
      intentCounts[msg.intent] = (intentCounts[msg.intent] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: {
        total_messages: totalMessages || 0,
        incoming_messages: incomingMessages || 0,
        outgoing_messages: (totalMessages || 0) - (incomingMessages || 0),
        automated_messages: automatedMessages || 0,
        manual_messages: (totalMessages || 0) - (automatedMessages || 0),
        common_intents: intentCounts
      },
      period: { start_date: startDate, end_date: endDate }
    });
  } catch (error) {
    console.error('Get message stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching message statistics'
    });
  }
};

// Route definitions
router.get('/conversations', authenticateToken, getConversations);
router.get('/conversations/:id', authenticateToken, getConversationMessages);
// router.post('/send', authenticateToken, sendMessage); // Deprecated - use WhatsApp routes
router.get('/stats', authenticateToken, getMessageStats);

module.exports = router;
