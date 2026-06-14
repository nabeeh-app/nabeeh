const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { DynamicTool } = require('@langchain/core/tools');
const { HumanMessage, SystemMessage, AIMessage, ToolMessage } = require('@langchain/core/messages');
const { supabaseAdmin } = require('../config/database');
const whatsappQuery = require('./whatsappQuery');
const logger = require('./logger');

// ── Model instance (reused across calls) ───────────────────────
const model = new ChatGoogleGenerativeAI({
  model: 'gemini-2.5-flash',
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 0.3,
  maxOutputTokens: 1024,
});

// ── Tier token limits ──────────────────────────────────────────
const TIER_MONTHLY_LIMITS = {
  free: 0,
  basic: 50000,
  pro: 200000,
  center: 500000,
};

// ── Tools ──────────────────────────────────────────────────────
const attendanceTool = new DynamicTool({
  name: 'getStudentAttendance',
  description: 'Get attendance record for a specific student. Input: JSON string with student_id (required) and days (optional, default 10).',
  func: async (input) => {
    try {
      const { student_id, days = 10 } = JSON.parse(input);
      if (!student_id) return JSON.stringify({ error: 'student_id is required' });

      const { data } = await supabaseAdmin
        .from('attendance')
        .select('status, notes, session:sessions!inner(date)')
        .eq('enrollment.student_id', student_id)
        .order('session.date', { ascending: false })
        .limit(days);

      const records = (data || []).map(r => ({
        date: r.session?.date,
        status: r.status,
        notes: r.notes,
      }));

      const present = records.filter(r => r.status === 'present').length;
      const total = records.length;

      return JSON.stringify({
        student_id,
        total_sessions: total,
        present,
        absent: total - present,
        rate: total > 0 ? ((present / total) * 100).toFixed(1) + '%' : 'N/A',
        recent: records.slice(0, 5),
      });
    } catch (e) {
      return JSON.stringify({ error: e.message });
    }
  },
});

const gradesTool = new DynamicTool({
  name: 'getStudentGrades',
  description: 'Get grades for a specific student across assessments. Input: JSON string with student_id (required) and subject (optional).',
  func: async (input) => {
    try {
      const { student_id, subject } = JSON.parse(input);
      if (!student_id) return JSON.stringify({ error: 'student_id is required' });

      const result = await whatsappQuery.getStudentGrades(student_id, subject);
      return JSON.stringify(result);
    } catch (e) {
      return JSON.stringify({ error: e.message });
    }
  },
});

const classPerformanceTool = new DynamicTool({
  name: 'getClassPerformance',
  description: 'Get aggregate class performance stats for a group. Input: JSON string with group_id (required) and assessment_type (optional).',
  func: async (input) => {
    try {
      const { group_id, assessment_type } = JSON.parse(input);
      if (!group_id) return JSON.stringify({ error: 'group_id is required' });

      let gradeQuery = supabaseAdmin
        .from('grades')
        .select('score, assessment:assessments!inner(max_score, type, name), enrollment:enrollments!inner(student_id)')
        .eq('enrollment.group_id', group_id);

      if (assessment_type) {
        gradeQuery = gradeQuery.eq('assessment.type', assessment_type);
      }

      const { data: grades } = await gradeQuery;
      if (!grades || grades.length === 0) return JSON.stringify({ message: 'No grades found for this group' });

      const avg = grades.reduce((sum, g) => {
        const pct = g.assessment?.max_score ? (g.score / g.assessment.max_score) * 100 : 0;
        return sum + pct;
      }, 0) / grades.length;

      const studentScores = {};
      grades.forEach(g => {
        if (!studentScores[g.enrollment?.student_id]) studentScores[g.enrollment.student_id] = [];
        const pct = g.assessment?.max_score ? (g.score / g.assessment.max_score) * 100 : 0;
        studentScores[g.enrollment.student_id].push(pct);
      });

      return JSON.stringify({
        group_id,
        total_grades: grades.length,
        class_average: avg.toFixed(1) + '%',
        students_count: Object.keys(studentScores).length,
        assessment_types: [...new Set(grades.map(g => g.assessment?.type).filter(Boolean))],
      });
    } catch (e) {
      return JSON.stringify({ error: e.message });
    }
  },
});

// ── Tool selection by tier ─────────────────────────────────────
const TOOLS_BY_TIER = {
  free: [],
  basic: [attendanceTool, gradesTool],
  pro: [attendanceTool, gradesTool, classPerformanceTool],
  center: [attendanceTool, gradesTool, classPerformanceTool],
};

// ── Token budgeting ────────────────────────────────────────────
async function checkTokenBudget(teacherId, tier) {
  const limit = TIER_MONTHLY_LIMITS[tier] || 0;
  if (limit === 0) return { allowed: false, reason: 'AI not available on free tier' };

  const { data: settings } = await supabaseAdmin
    .from('teacher_settings')
    .select('ai_tokens_used_this_month, ai_token_reset_at')
    .eq('teacher_id', teacherId)
    .single();

  const used = settings?.ai_tokens_used_this_month || 0;
  const resetAt = settings?.ai_token_reset_at;

  // Reset if month has passed
  if (resetAt && new Date(resetAt) < new Date()) {
    await supabaseAdmin
      .from('teacher_settings')
      .update({
        ai_tokens_used_this_month: 0,
        ai_token_reset_at: new Date().toISOString(),
      })
      .eq('teacher_id', teacherId);
    return { allowed: true, remaining: limit };
  }

  if (used >= limit) return { allowed: false, reason: 'Monthly AI limit reached' };
  return { allowed: true, remaining: limit - used };
}

async function trackTokenUsage(teacherId, result) {
  try {
    // Rough estimate: ~4 chars per token
    const outputText = result?.output || '';
    const toolCalls = result?.intermediateSteps || [];
    let estimatedTokens = Math.ceil(outputText.length / 4);
    toolCalls.forEach(step => {
      estimatedTokens += Math.ceil(JSON.stringify(step?.action?.toolInput || {}).length / 4);
      estimatedTokens += Math.ceil(JSON.stringify(step?.observation || {}).length / 4);
    });

    await supabaseAdmin.rpc('increment_token_usage', {
      p_teacher_id: teacherId,
      p_tokens: estimatedTokens,
    }).then(() => {}).catch(() => {
      // Fallback: direct update if RPC doesn't exist
      supabaseAdmin
        .from('teacher_settings')
        .select('ai_tokens_used_this_month')
        .eq('teacher_id', teacherId)
        .single()
        .then(({ data }) => {
          supabaseAdmin
            .from('teacher_settings')
            .update({ ai_tokens_used_this_month: (data?.ai_tokens_used_this_month || 0) + estimatedTokens })
            .eq('teacher_id', teacherId);
        });
    });
  } catch (e) {
    logger.error('Token tracking error', { error: e.message });
  }
}

// ── Conversation context builder ───────────────────────────────
async function buildConversationContext(conversationId, limit = 5) {
  if (!conversationId) return [];

  const { data: messages } = await supabaseAdmin
    .from('messages')
    .select('direction, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!messages) return [];

  return messages.reverse().map(m =>
    m.direction === 'inbound'
      ? new HumanMessage(m.content)
      : new AIMessage(m.content)
  );
}

// ── Manual tool-calling agent loop ─────────────────────────────
async function runAgentWithTools(agent, tools, input, chatHistory) {
  const toolMap = {};
  tools.forEach(t => { toolMap[t.name] = t; });

  const messages = [
    ...chatHistory,
    new HumanMessage(input),
  ];

  // Run up to 10 iterations (safety cap)
  for (let i = 0; i < 10; i++) {
    const response = await agent.invoke({ messages });

    // If no tool calls, we're done
    const toolCalls = response?.tool_calls || [];
    if (toolCalls.length === 0) {
      const lastMsg = response?.content || '';
      return {
        text: lastMsg,
        toolsUsed: [],
      };
    }

    // Execute tool calls
    const toolsUsed = [];
    for (const tc of toolCalls) {
      const tool = toolMap[tc.name];
      if (!tool) {
        messages.push(new ToolMessage(`Tool ${tc.name} not found`, tc.id));
        continue;
      }

      const inputStr = typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args);
      const result = await tool.invoke(inputStr);
      messages.push(new ToolMessage(result, tc.id));
      toolsUsed.push(tc.name);
    }

    // Feed tool results back to model
    const followUp = await agent.invoke({ messages });

    // If model produced final answer after tools
    if (followUp?.tool_calls?.length === 0) {
      return {
        text: followUp.content || '',
        toolsUsed,
      };
    }

    // Continue loop if more tool calls
    if (i === 9) {
      // Safety: return whatever we have
      return {
        text: followUp?.content || 'I was unable to complete the analysis.',
        toolsUsed,
      };
    }
  }

  return { text: 'Maximum tool call iterations reached.', toolsUsed: [] };
}

// ── Main entry point ───────────────────────────────────────────
async function generateWithTools(message, { teacherId, tier, language, conversationId }) {
  if (tier === 'free') return null;

  const budgetCheck = await checkTokenBudget(teacherId, tier);
  if (!budgetCheck.allowed) return null;

  const tools = TOOLS_BY_TIER[tier] || [];
  const langLabel = language === 'ar' ? 'Arabic' : 'English';

  // Fetch teacher info for system prompt
  const { data: teacher } = await supabaseAdmin
    .from('teachers')
    .select('name, business_name')
    .eq('id', teacherId)
    .single();

  const teacherName = teacher?.name || 'Teacher';
  const businessName = teacher?.business_name || teacherName;

  const systemPrompt = `You are a helpful teaching assistant for ${businessName} on Nabeeh.
Respond in ${langLabel}.
You have access to student attendance and grade data via tools.
Always be professional, educational, and culturally appropriate.
Protect student privacy — never share personal information.
If you don't know something, acknowledge it honestly.
Keep responses concise and actionable.`;

  // Build model with tools bound
  const modelWithTools = tools.length > 0
    ? model.bindTools(tools)
    : model;

  const chatHistory = await buildConversationContext(conversationId, 5);

  const agentMessages = [
    new SystemMessage(systemPrompt),
    ...chatHistory,
    new HumanMessage(message),
  ];

  const result = await runAgentWithTools(modelWithTools, tools, message, [
    new SystemMessage(systemPrompt),
    ...chatHistory,
  ]);

  await trackTokenUsage(teacherId, { output: result.text });

  return {
    text: result.text,
    toolsUsed: result.toolsUsed,
  };
}

// ── Report comment generator ───────────────────────────────────
async function generateReportComment(studentData, teacherContext) {
  const { studentName, grades, attendance, trends, language } = studentData;
  const { teacherName, businessName } = teacherContext;
  const langLabel = language === 'ar' ? 'Arabic' : 'English';

  const prompt = `Generate a professional student progress report comment in ${langLabel}.

Student: ${studentName}
Teacher: ${teacherName} (${businessName})

Attendance Summary:
- Total sessions: ${attendance.total_sessions || 0}
- Present: ${attendance.present || 0}
- Attendance rate: ${attendance.rate || 'N/A'}

Recent Grades:
${(grades || []).map(g => `- ${g.subject || 'Subject'}: ${g.score}/${g.max_score} (${g.percentage || 'N/A'}%)`).join('\n') || 'No grades available'}

Trends:
${trends || 'No trend data available'}

Write a professional, constructive report comment that:
1. Highlights strengths and positive progress
2. Areas for improvement
3. Specific recommendations
4. Encouraging tone
Keep it 3-5 sentences. Be specific and data-driven.`;

  const response = await model.invoke([new HumanMessage(prompt)]);
  return response.content || '';
}

// ── Anomaly detection helper (used by anomalyDetector.js) ─────
async function detectAnomalies(teacherId) {
  // This is a lightweight wrapper; the actual detection logic lives in anomalyDetector.js
  // This function is kept for backward compatibility with aiResponder.js consumers
  return { anomalies: [], message: 'Use anomalyDetector.js for full detection' };
}

// ── Weekly digest generator ────────────────────────────────────
async function generateWeeklyDigest(digestData, language) {
  const langLabel = language === 'ar' ? 'Arabic' : 'English';

  const prompt = `Generate a weekly teaching digest summary in ${langLabel}.

Data for this week:
- Improved attendance: ${JSON.stringify(digestData.improved || [])}
- Declining attendance: ${JSON.stringify(digestData.declining || [])}
- Grade changes: ${JSON.stringify(digestData.gradeChanges || [])}
- At-risk students: ${JSON.stringify(digestData.atRisk || [])}

Provide:
1. Key highlights (what went well)
2. Areas of concern
3. Action items for the teacher
Keep it concise and actionable. Use bullet points.`;

  const response = await model.invoke([new HumanMessage(prompt)]);
  return response.content || '';
}

module.exports = {
  generateWithTools,
  generateReportComment,
  detectAnomalies,
  generateWeeklyDigest,
  buildConversationContext,
  checkTokenBudget,
};
