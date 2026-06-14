jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn()
  }
}));

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const whatsappQuery = require('../../lib/whatsappQuery');
const { supabase } = require('../../config/database');

describe('whatsappQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getParentByPhone', () => {
    it('should return parent with student and teacher data', async () => {
      const mockParent = {
        id: 'p1',
        name: 'Parent Name',
        phone: '+201234567890',
        students: [{
          id: 's1',
          name: 'Ahmed',
          enrollments: [{
            id: 'e1',
            group: {
              id: 'g1',
              offering: {
                id: 'off1',
                teacher_id: 'teacher-1',
                teacher: { id: 'teacher-1', name: 'Mr. Teacher', business_name: null }
              }
            }
          }]
        }]
      };

      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockParent, error: null })
      };

      supabase.from.mockReturnValueOnce(chain);

      const result = await whatsappQuery.getParentByPhone('+201234567890');

      expect(result).toEqual(mockParent);
      expect(result.students[0].enrollments[0].group.offering.teacher_id).toBe('teacher-1');
    });

    it('should return null when parent not found', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
      };

      supabase.from.mockReturnValueOnce(chain);

      const result = await whatsappQuery.getParentByPhone('+999999999999');

      expect(result).toBeNull();
    });
  });

  describe('findOrCreateConversation', () => {
    it('should return existing conversation', async () => {
      const mockConversation = { id: 'conv-1', parent_id: 'p1', teacher_id: 'teacher-1', whatsapp_chat_id: 'chat-1' };

      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockConversation, error: null })
      };

      supabase.from.mockReturnValueOnce(chain);

      const result = await whatsappQuery.findOrCreateConversation('p1', 'teacher-1', 'chat-1');

      expect(result).toEqual(mockConversation);
    });

    it('should create new conversation when none exists', async () => {
      const mockNewConversation = { id: 'conv-2', parent_id: 'p1', teacher_id: 'teacher-1', whatsapp_chat_id: 'chat-2' };

      // First call: select returns null
      const findChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      };

      // Second call: insert returns new conversation
      const createChain = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockNewConversation, error: null })
          })
        })
      };

      supabase.from
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(createChain);

      const result = await whatsappQuery.findOrCreateConversation('p1', 'teacher-1', 'chat-2');

      expect(result).toEqual(mockNewConversation);
    });

    it('should return null on create error', async () => {
      const findChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      };

      const createChain = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } })
          })
        })
      };

      supabase.from
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(createChain);

      const result = await whatsappQuery.findOrCreateConversation('p1', 'teacher-1', 'chat-2');

      expect(result).toBeNull();
    });
  });

  describe('getStudentAttendance', () => {
    it('should return today attendance when present', async () => {
      const today = new Date().toISOString().split('T')[0];
      const mockAttendance = {
        id: 'a1',
        status: 'present',
        session: { date: today }
      };

      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockAttendance, error: null })
      };

      supabase.from.mockReturnValueOnce(chain);

      const result = await whatsappQuery.getStudentAttendance('s1');

      expect(result).toEqual(mockAttendance);
      expect(result.status).toBe('present');
    });

    it('should return null when no attendance record today', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      };

      supabase.from.mockReturnValueOnce(chain);

      const result = await whatsappQuery.getStudentAttendance('s1');

      expect(result).toBeNull();
    });
  });

  describe('getStudentGrades', () => {
    it('should flatten nested grade results into simple objects', async () => {
      const mockRawGrades = [
        {
          score: 85,
          assessment: { name: 'Midterm', max_score: 100, date: '2026-06-01', type: 'midterm' },
          enrollment: {
            student_id: 's1',
            group: {
              offering: {
                subject: { name_en: 'Math', name_ar: 'رياضيات', code: 'MATH' }
              }
            }
          }
        },
        {
          score: 90,
          assessment: { name: 'Quiz 1', max_score: 100, date: '2026-06-03', type: 'quiz' },
          enrollment: {
            student_id: 's1',
            group: {
              offering: {
                subject: { name_en: 'English', name_ar: null, code: 'ENG' }
              }
            }
          }
        }
      ];

      const mockAllGrades = [
        {
          score: 85,
          assessment: { max_score: 100, type: 'midterm' },
          enrollment: {
            student_id: 's1',
            group: {
              offering: {
                subject: { name_en: 'Math', code: 'MATH' }
              }
            }
          }
        }
      ];

      const recentChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnValue({
          then: jest.fn().mockImplementation((resolve) => {
            resolve({ data: mockRawGrades, error: null });
          })
        })
      };

      const allChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: mockAllGrades, error: null });
        })
      };

      supabase.from
        .mockReturnValueOnce(recentChain)
        .mockReturnValueOnce(allChain);

      const result = await whatsappQuery.getStudentGrades('s1', null);

      expect(result.recentGrades).toHaveLength(2);
      expect(result.recentGrades[0]).toEqual({
        subject: 'Math',
        score: 85,
        max_score: 100,
        percentage: '85.0',
        date: '2026-06-01',
        type: 'midterm'
      });
      expect(result.recentGrades[1].subject).toBe('English');
      expect(result.recentGrades[1].percentage).toBe('90.0');

      expect(result.allGrades).toHaveLength(1);
      expect(result.allGrades[0].percentage).toBe(85);
    });

    it('should use name_ar when name_en is null', async () => {
      const mockRawGrades = [
        {
          score: 85,
          assessment: { name: 'Midterm', max_score: 100, date: '2026-06-01', type: 'midterm' },
          enrollment: {
            student_id: 's1',
            group: {
              offering: {
                subject: { name_en: null, name_ar: 'رياضيات', code: 'MATH' }
              }
            }
          }
        }
      ];

      const recentChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnValue({
          then: jest.fn().mockImplementation((resolve) => {
            resolve({ data: mockRawGrades, error: null });
          })
        })
      };

      const allChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [], error: null });
        })
      };

      supabase.from
        .mockReturnValueOnce(recentChain)
        .mockReturnValueOnce(allChain);

      const result = await whatsappQuery.getStudentGrades('s1', null);

      expect(result.recentGrades[0].subject).toBe('رياضيات');
    });

    it('should return Unknown when both name_en and name_ar are null', async () => {
      const mockRawGrades = [
        {
          score: 85,
          assessment: { name: 'Midterm', max_score: 100, date: '2026-06-01', type: 'midterm' },
          enrollment: {
            student_id: 's1',
            group: {
              offering: {
                subject: { name_en: null, name_ar: null, code: 'MATH' }
              }
            }
          }
        }
      ];

      const recentChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnValue({
          then: jest.fn().mockImplementation((resolve) => {
            resolve({ data: mockRawGrades, error: null });
          })
        })
      };

      const allChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [], error: null });
        })
      };

      supabase.from
        .mockReturnValueOnce(recentChain)
        .mockReturnValueOnce(allChain);

      const result = await whatsappQuery.getStudentGrades('s1', null);

      expect(result.recentGrades[0].subject).toBe('Unknown');
    });

    it('should return N/A percentage when max_score is null', async () => {
      const mockRawGrades = [
        {
          score: 85,
          assessment: { name: 'Midterm', max_score: null, date: '2026-06-01', type: 'midterm' },
          enrollment: {
            student_id: 's1',
            group: {
              offering: {
                subject: { name_en: 'Math', name_ar: null, code: 'MATH' }
              }
            }
          }
        }
      ];

      const recentChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnValue({
          then: jest.fn().mockImplementation((resolve) => {
            resolve({ data: mockRawGrades, error: null });
          })
        })
      };

      const allChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [], error: null });
        })
      };

      supabase.from
        .mockReturnValueOnce(recentChain)
        .mockReturnValueOnce(allChain);

      const result = await whatsappQuery.getStudentGrades('s1', null);

      expect(result.recentGrades[0].percentage).toBe('N/A');
    });
  });

  describe('saveMessage', () => {
    it('should update last_message_at after saving message', async () => {
      const insertChain = {
        insert: jest.fn().mockResolvedValue({ error: null })
      };

      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      };

      supabase.from
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(updateChain);

      await whatsappQuery.saveMessage('conv-1', 'incoming', 'Hello', {});

      expect(insertChain.insert).toHaveBeenCalledWith([{
        conversation_id: 'conv-1',
        direction: 'incoming',
        content: 'Hello'
      }]);

      expect(updateChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ last_message_at: expect.any(String) })
      );
      expect(updateChain.eq).toHaveBeenCalledWith('id', 'conv-1');
    });

    it('should still update last_message_at even if insert fails', async () => {
      const insertChain = {
        insert: jest.fn().mockResolvedValue({ error: { message: 'insert failed' } })
      };

      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      };

      supabase.from
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(updateChain);

      await whatsappQuery.saveMessage('conv-1', 'incoming', 'Hello', {});

      expect(updateChain.update).toHaveBeenCalled();
    });
  });

  describe('getMatchingFaq', () => {
    it('should match FAQ when message contains a pattern', async () => {
      const mockFaqs = [
        {
          id: 'faq-1',
          question_patterns: ['school hours', 'مواعيد'],
          answer: 'School starts at 8am',
          usage_count: 5,
          language: 'en',
          is_active: true
        },
        {
          id: 'faq-2',
          question_patterns: ['homework', 'واجب'],
          answer: 'Homework is due on Friday',
          usage_count: 2,
          language: 'en',
          is_active: true
        }
      ];

      const selectChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: mockFaqs, error: null });
        })
      };

      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      };

      supabase.from
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain);

      const result = await whatsappQuery.getMatchingFaq('teacher-1', 'en', 'What are school hours?');

      expect(result).toEqual(mockFaqs[0]);
      expect(result.answer).toBe('School starts at 8am');
      expect(updateChain.update).toHaveBeenCalledWith({ usage_count: 6 });
      expect(updateChain.eq).toHaveBeenCalledWith('id', 'faq-1');
    });

    it('should return null when no FAQ pattern matches', async () => {
      const mockFaqs = [
        {
          id: 'faq-1',
          question_patterns: ['school hours', 'مواعيد'],
          answer: 'School starts at 8am',
          usage_count: 5,
          language: 'en',
          is_active: true
        }
      ];

      const selectChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: mockFaqs, error: null });
        })
      };

      supabase.from.mockReturnValueOnce(selectChain);

      const result = await whatsappQuery.getMatchingFaq('teacher-1', 'en', 'random unrelated message');

      expect(result).toBeNull();
    });

    it('should return null when no FAQs exist', async () => {
      const selectChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [], error: null });
        })
      };

      supabase.from.mockReturnValueOnce(selectChain);

      const result = await whatsappQuery.getMatchingFaq('teacher-1', 'en', 'What are school hours?');

      expect(result).toBeNull();
    });

    it('should match case-insensitively', async () => {
      const mockFaqs = [
        {
          id: 'faq-1',
          question_patterns: ['SCHOOL HOURS'],
          answer: 'School starts at 8am',
          usage_count: 0,
          language: 'en',
          is_active: true
        }
      ];

      const selectChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: mockFaqs, error: null });
        })
      };

      const updateChain = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null })
      };

      supabase.from
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(updateChain);

      const result = await whatsappQuery.getMatchingFaq('teacher-1', 'en', 'what are school hours?');

      expect(result).toEqual(mockFaqs[0]);
    });
  });
});
