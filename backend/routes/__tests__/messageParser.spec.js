jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const messageParser = require('../../lib/messageParser');

describe('messageParser', () => {
  describe('formatGradesResponse', () => {
    const studentName = 'Ahmed';

    it('should format recent grades with correct property paths', () => {
      const grades = {
        recentGrades: [
          { subject: 'Math', score: 85, max_score: 100, percentage: '85.0', date: '2026-06-01', type: 'midterm' },
          { subject: 'English', score: 90, max_score: 100, percentage: '90.0', date: '2026-06-03', type: 'quiz' }
        ],
        allGrades: [
          { score: 85, max_score: 100, percentage: 85 },
          { score: 90, max_score: 100, percentage: 90 }
        ]
      };

      const result = messageParser.formatGradesResponse(studentName, grades, null, 'en');

      expect(result).toContain('Math: 85/100');
      expect(result).toContain('English: 90/100');
      expect(result).toContain('85.0%');
      expect(result).toContain('90.0%');
      expect(result).toContain('Overall Average');
    });

    it('should format grades in Arabic', () => {
      const grades = {
        recentGrades: [
          { subject: 'رياضيات', score: 85, max_score: 100, percentage: '85.0', date: '2026-06-01', type: 'midterm' }
        ],
        allGrades: [
          { score: 85, max_score: 100, percentage: 85 }
        ]
      };

      const result = messageParser.formatGradesResponse(studentName, grades, null, 'ar');

      expect(result).toContain('رياضيات: 85/100');
      expect(result).toContain('المعدل العام');
    });

    it('should filter by subject when provided', () => {
      const grades = {
        recentGrades: [
          { subject: 'Math', score: 85, max_score: 100, percentage: '85.0', date: '2026-06-01', type: 'midterm' }
        ],
        allGrades: [
          { score: 85, max_score: 100, percentage: 85 }
        ]
      };

      const result = messageParser.formatGradesResponse(studentName, grades, 'Math', 'en');

      expect(result).toContain('Grades for Ahmed Math');
      expect(result).toContain('Average in Math');
    });

    it('should return no-grades message when recentGrades is empty', () => {
      const grades = { recentGrades: [], allGrades: [] };

      const result = messageParser.formatGradesResponse(studentName, grades, null, 'en');

      expect(result).toContain('No published grades yet');
    });

    it('should return no-grades message for specific subject when empty', () => {
      const grades = { recentGrades: [], allGrades: [] };

      const result = messageParser.formatGradesResponse(studentName, grades, 'Math', 'en');

      expect(result).toContain('No published grades in Math yet');
    });

    it('should handle grades with N/A percentage when max_score is missing', () => {
      const grades = {
        recentGrades: [
          { subject: 'Math', score: 85, max_score: null, percentage: 'N/A', date: '2026-06-01', type: 'midterm' }
        ],
        allGrades: []
      };

      const result = messageParser.formatGradesResponse(studentName, grades, null, 'en');

      expect(result).toContain('Math: 85/null');
    });
  });

  describe('detectIntent', () => {
    it('should detect attendance intent in English', () => {
      const result = messageParser.detectIntent('What is the attendance today?', 'en');
      expect(result.intent).toBe('attendance');
    });

    it('should detect grades intent with subject in Arabic', () => {
      const result = messageParser.detectIntent('درجات الرياضيات', 'ar');
      expect(result.intent).toBe('grades');
      expect(result.params.subject).toBe('رياضيات');
    });

    it('should detect help intent', () => {
      const result = messageParser.detectIntent('help', 'en');
      expect(result.intent).toBe('help');
    });

    it('should return general intent for unrecognized messages', () => {
      const result = messageParser.detectIntent('hello world', 'en');
      expect(result.intent).toBe('general');
    });
  });

  describe('formatAttendanceResponse', () => {
    it('should format present attendance in Arabic', () => {
      const result = messageParser.formatAttendanceResponse('Ahmed', { status: 'present' }, 'ar');
      expect(result).toContain('Ahmed');
      expect(result).toContain('حضر');
    });

    it('should format absent attendance in English', () => {
      const result = messageParser.formatAttendanceResponse('Ahmed', { status: 'absent' }, 'en');
      expect(result).toContain('was absent');
    });

    it('should handle null attendance', () => {
      const result = messageParser.formatAttendanceResponse('Ahmed', null, 'en');
      expect(result).toContain('not recorded yet');
    });
  });
});
