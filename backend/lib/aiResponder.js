const axios = require('axios');
const logger = require('./logger');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Generate AI response using Gemini
 * Uses header-based API key (NOT URL query param)
 */
async function generateResponse(message, { parentName, studentName, teacherName, subjects, language, businessName }) {
  if (!GEMINI_API_KEY) {
    logger.error('GEMINI_API_KEY not configured');
    return null;
  }

  try {
    const langLabel = language === 'ar' ? 'Arabic' : 'English';
    const context = `You are ${teacherName}, a professional teacher using Nabeeh - an AI-powered teaching assistant. You're responding to ${parentName}, parent of ${studentName}.
    Respond in ${langLabel}.
    Keep responses helpful, professional, and educational.
    You teach ${subjects || 'various subjects'}.
    Business: ${businessName || teacherName}
    
    Important Guidelines:
    1. Maintain professional teacher-parent communication standards
    2. Protect student privacy - never share personal information
    3. Focus on educational support and student progress
    4. Be respectful and culturally appropriate
    5. Provide accurate information based on the student's data
    6. If you don't know something, acknowledge it honestly
    7. Keep responses clear and helpful for parents`;

    const prompt = `${context}\n\nParent message: ${message}\n\nYour professional educational response:`;

    const response = await axios.post(GEMINI_URL, {
      contents: [{
        parts: [{ text: prompt }]
      }]
    }, {
      headers: {
        'x-goog-api-key': GEMINI_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const aiText = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (aiText) {
      return {
        text: aiText,
        intent: 'general',
        confidence: 0.6
      };
    }

    return null;
  } catch (error) {
    logger.error('AI response error', { error: error.message });
    return null;
  }
}

module.exports = { generateResponse };
