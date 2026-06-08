const logger = require('./logger');

const INTENT_KEYWORDS = {
  attendance: {
    ar: ['حضور', 'غياب', 'attendance', 'absent', 'present', 'ateed'],
    en: ['attend', 'absent', 'attendance', 'presence']
  },
  grades: {
    ar: ['درجة', 'نتيجة', 'علامة', 'معدل', 'درجات', 'الدرجات'],
    en: ['grade', 'score', 'mark', 'average', 'grades']
  },
  help: {
    ar: ['مساعدة', 'ماذا يمكنني', 'كيف', 'help'],
    en: ['help', 'what can i', 'how']
  }
};

const SUBJECT_KEYWORDS = {
  ar: {
    'عربي': 'عربي',
    'لغة عربية': 'عربي',
    'عربية': 'عربي',
    'انجليزي': 'انجليزي',
    'لغة انجليزية': 'انجليزي',
    'انجليزية': 'انجليزي',
    'english': 'انجليزي',
    'رياضيات': 'رياضيات',
    'حساب': 'رياضيات',
    'math': 'رياضيات',
    'علوم': 'علوم',
    'science': 'علوم',
    'تاريخ': 'تاريخ',
    'history': 'تاريخ',
    'جغرافيا': 'جغرافيا',
    'geography': 'جغرافيا'
  },
  en: {
    'arabic': 'Arabic',
    'english': 'English',
    'math': 'Math',
    'mathematics': 'Math',
    'science': 'Science',
    'history': 'History',
    'geography': 'Geography'
  }
};

/**
 * Detect intent and extract parameters from a message
 * @returns {{ intent: string, params: object, confidence: number }}
 */
function detectIntent(text, language = 'ar') {
  const lower = text.toLowerCase();
  const keywords = language === 'ar' ? INTENT_KEYWORDS : {
    attendance: INTENT_KEYWORDS.attendance.en,
    grades: INTENT_KEYWORDS.grades.en,
    help: INTENT_KEYWORDS.help.en
  };

  // Check attendance intent
  for (const kw of keywords.attendance) {
    if (lower.includes(kw)) {
      return { intent: 'attendance', params: {}, confidence: 0.9 };
    }
  }

  // Check grades intent + extract subject
  for (const kw of keywords.grades) {
    if (lower.includes(kw)) {
      const subjectKw = SUBJECT_KEYWORDS[language] || SUBJECT_KEYWORDS.ar;
      let detectedSubject = null;
      for (const [keyword, subject] of Object.entries(subjectKw)) {
        if (lower.includes(keyword)) {
          detectedSubject = subject;
          break;
        }
      }
      return {
        intent: 'grades',
        params: detectedSubject ? { subject: detectedSubject } : {},
        confidence: detectedSubject ? 0.95 : 0.85
      };
    }
  }

  // Check help intent
  for (const kw of keywords.help) {
    if (lower.includes(kw)) {
      return { intent: 'help', params: {}, confidence: 0.9 };
    }
  }

  return { intent: 'general', params: {}, confidence: 0.3 };
}

/**
 * Generate a formatted attendance response
 */
function formatAttendanceResponse(studentName, attendance, language) {
  if (!attendance) {
    return language === 'ar'
      ? 'لم يتم تسجيل الحضور بعد اليوم'
      : 'Attendance not recorded yet today';
  }

  const statusMap = {
    present: { ar: 'حضر', en: 'attended' },
    absent: { ar: 'غاب', en: 'was absent' },
    late: { ar: 'تأخر', en: 'was late' },
    excused: { ar: 'معذور', en: 'was excused' }
  };

  const status = statusMap[attendance.status] || statusMap.present;
  const label = status[language] || status.en;

  return language === 'ar'
    ? `${studentName} ${label} اليوم`
    : `${studentName} ${label} today`;
}

/**
 * Generate a formatted grades response
 */
function formatGradesResponse(studentName, { recentGrades, allGrades }, subject, language) {
  if (!recentGrades || recentGrades.length === 0) {
    return language === 'ar'
      ? (subject ? `لا توجد درجات منشورة في ${subject} حتى الآن` : 'لا توجد درجات منشورة حتى الآن')
      : (subject ? `No published grades in ${subject} yet` : 'No published grades yet');
  }

  const lines = [];
  const subjectLabel = subject ? ` ${subject}` : '';

  if (language === 'ar') {
    lines.push(`📊 درجات ${studentName}${subjectLabel}:\n`);
    lines.push('🔸 آخر الدرجات:');
    recentGrades.forEach(g => {
      const date = new Date(g.date).toLocaleDateString('ar-EG');
      lines.push(`• ${g.subject}: ${g.score}/${g.max_score} (${g.percentage}%) - ${date}`);
    });
    if (allGrades && allGrades.length > 0) {
      const avg = allGrades.reduce((s, g) => s + g.percentage, 0) / allGrades.length;
      lines.push(subject
        ? `\n📈 المعدل في ${subject}: ${avg.toFixed(1)}%`
        : `\n🎯 المعدل العام: ${avg.toFixed(1)}%`);
    }
  } else {
    lines.push(`📊 Grades for ${studentName}${subjectLabel}:\n`);
    lines.push('🔸 Recent Grades:');
    recentGrades.forEach(g => {
      const date = new Date(g.date).toLocaleDateString('en-US');
      lines.push(`• ${g.subject}: ${g.score}/${g.max_score} (${g.percentage}%) - ${date}`);
    });
    if (allGrades && allGrades.length > 0) {
      const avg = allGrades.reduce((s, g) => s + g.percentage, 0) / allGrades.length;
      lines.push(subject
        ? `\n📈 Average in ${subject}: ${avg.toFixed(1)}%`
        : `\n🎯 Overall Average: ${avg.toFixed(1)}%`);
    }
  }

  return lines.join('\n');
}

/**
 * Generate help message
 */
function getHelpMessage(parentName, language) {
  if (language === 'ar') {
    return `مرحباً ${parentName}! 👋\n\nيمكنني مساعدتك في:\n\n📊 *الدرجات:*\n• "درجات ابني" - لرؤية جميع الدرجات\n• "درجات الرياضيات" - لدرجات مادة معينة\n• "معدل ابني" - للمعدل العام\n\n📅 *الحضور:*\n• "حضور ابني" - لمعرفة حالة الحضور اليوم\n• "غياب ابني" - لمعرفة حالة الغياب\n\n❓ *للمساعدة:*\n• "مساعدة" - لعرض هذه الرسالة\n\nأي سؤال آخر، سأحاول مساعدتك! 😊`;
  }
  return `Hello ${parentName}! 👋\n\nI can help you with:\n\n📊 *Grades:*\n• "My child's grades" - to see all grades\n• "Math grades" - for specific subject grades\n• "My child's average" - for overall average\n\n📅 *Attendance:*\n• "My child's attendance" - to check today's attendance\n• "My child's absence" - to check absence status\n\n❓ *For Help:*\n• "help" - to show this message\n\nAny other questions, I'll try to help! 😊`;
}

module.exports = {
  detectIntent,
  formatAttendanceResponse,
  formatGradesResponse,
  getHelpMessage
};
