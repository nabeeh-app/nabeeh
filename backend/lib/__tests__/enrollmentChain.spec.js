jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn()
  }
}));

jest.mock('../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const { supabase } = require('../../config/database');

function createChainable(resolveWith) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(resolveWith),
    single: jest.fn().mockResolvedValue(resolveWith),
    then: jest.fn().mockImplementation((resolve) => resolve(resolveWith))
  };
  return chain;
}

const {
  verifyStudentAccess,
  verifyOfferingAccess,
  verifyGroupAccess,
  getTeacherEnrollments,
  getTeacherStudents,
  getStudentEnrollmentsForTeacher,
  createStudentsQuery
} = require('../enrollmentChain');

describe('enrollmentChain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('verifyStudentAccess', () => {
    it('should return enrollment when teacher owns student', async () => {
      const enrollmentData = { id: 'e1', student_id: 's1', group_id: 'g1', status: 'active' };
      supabase.from.mockReturnValue(createChainable({ data: enrollmentData, error: null }));

      const result = await verifyStudentAccess('s1', 'teacher-1');

      expect(result).toEqual(enrollmentData);
      expect(supabase.from).toHaveBeenCalledWith('enrollments');
    });

    it('should return null when teacher does not own student', async () => {
      supabase.from.mockReturnValue(createChainable({ data: null, error: null }));

      const result = await verifyStudentAccess('s1', 'teacher-1');

      expect(result).toBeNull();
    });

    it('should return null on database error', async () => {
      supabase.from.mockReturnValue(createChainable({ data: null, error: { message: 'DB error' } }));

      const result = await verifyStudentAccess('s1', 'teacher-1');

      expect(result).toBeNull();
    });

    it('should query with correct filters', async () => {
      const chain = createChainable({ data: null, error: null });
      supabase.from.mockReturnValue(chain);

      await verifyStudentAccess('student-42', 'teacher-99');

      expect(chain.eq).toHaveBeenCalledWith('student_id', 'student-42');
      expect(chain.eq).toHaveBeenCalledWith('teacher_id', 'teacher-99');
      expect(chain.limit).toHaveBeenCalledWith(1);
      expect(chain.maybeSingle).toHaveBeenCalled();
    });
  });

  describe('verifyOfferingAccess', () => {
    it('should return offering when teacher owns it', async () => {
      const offering = { id: 'o1', teacher_id: 'teacher-1' };
      supabase.from.mockReturnValue(createChainable({ data: offering, error: null }));

      const result = await verifyOfferingAccess('o1', 'teacher-1');

      expect(result).toEqual(offering);
      expect(supabase.from).toHaveBeenCalledWith('offerings');
    });

    it('should return null when teacher does not own offering', async () => {
      supabase.from.mockReturnValue(createChainable({ data: null, error: null }));

      const result = await verifyOfferingAccess('o1', 'teacher-1');

      expect(result).toBeNull();
    });

    it('should return null on database error', async () => {
      supabase.from.mockReturnValue(createChainable({ data: null, error: { message: 'Not found' } }));

      const result = await verifyOfferingAccess('o1', 'teacher-1');

      expect(result).toBeNull();
    });

    it('should use single() for exact match', async () => {
      const chain = createChainable({ data: null, error: null });
      supabase.from.mockReturnValue(chain);

      await verifyOfferingAccess('o1', 'teacher-1');

      expect(chain.eq).toHaveBeenCalledWith('id', 'o1');
      expect(chain.eq).toHaveBeenCalledWith('teacher_id', 'teacher-1');
      expect(chain.single).toHaveBeenCalled();
    });
  });

  describe('verifyGroupAccess', () => {
    it('should return group with offering info when teacher owns it', async () => {
      const groupData = { id: 'g1', offering_id: 'o1', offerings: { id: 'o1', teacher_id: 'teacher-1' } };
      supabase.from.mockReturnValue(createChainable({ data: groupData, error: null }));

      const result = await verifyGroupAccess('g1', 'teacher-1');

      expect(result).toEqual(groupData);
      expect(supabase.from).toHaveBeenCalledWith('groups');
    });

    it('should return null when teacher does not own group', async () => {
      supabase.from.mockReturnValue(createChainable({ data: null, error: null }));

      const result = await verifyGroupAccess('g1', 'teacher-1');

      expect(result).toBeNull();
    });

    it('should return null on database error', async () => {
      supabase.from.mockReturnValue(createChainable({ data: null, error: { message: 'Not found' } }));

      const result = await verifyGroupAccess('g1', 'teacher-1');

      expect(result).toBeNull();
    });
  });

  describe('getTeacherEnrollments', () => {
    it('should return enrollment records for teacher', async () => {
      const enrollments = [
        { id: 'e1', student_id: 's1', group_id: 'g1' },
        { id: 'e2', student_id: 's2', group_id: 'g2' }
      ];
      supabase.from.mockReturnValue(createChainable({ data: enrollments, error: null }));

      const result = await getTeacherEnrollments('teacher-1');

      expect(result).toEqual(enrollments);
      expect(result).toHaveLength(2);
    });

    it('should return empty array on error', async () => {
      supabase.from.mockReturnValue(createChainable({ data: null, error: { message: 'DB error' } }));

      const result = await getTeacherEnrollments('teacher-1');

      expect(result).toEqual([]);
    });

    it('should return empty array when no enrollments found', async () => {
      supabase.from.mockReturnValue(createChainable({ data: [], error: null }));

      const result = await getTeacherEnrollments('teacher-1');

      expect(result).toEqual([]);
    });

    it('should filter by teacher_id and exclude null student_id', async () => {
      const chain = createChainable({ data: [], error: null });
      supabase.from.mockReturnValue(chain);

      await getTeacherEnrollments('teacher-1');

      expect(chain.eq).toHaveBeenCalledWith('teacher_id', 'teacher-1');
      expect(chain.not).toHaveBeenCalledWith('student_id', 'is', null);
    });
  });

  describe('getTeacherStudents', () => {
    it('should return students with enrollment and group info', async () => {
      const students = [
        { id: 's1', name: 'Ahmed', enrollments: [{ id: 'e1' }] }
      ];
      supabase.from.mockReturnValue(createChainable({ data: students, error: null }));

      const result = await getTeacherStudents('teacher-1');

      expect(result).toEqual(students);
    });

    it('should return empty array on error', async () => {
      supabase.from.mockReturnValue(createChainable({ data: null, error: { message: 'DB error' } }));

      const result = await getTeacherStudents('teacher-1');

      expect(result).toEqual([]);
    });
  });

  describe('getStudentEnrollmentsForTeacher', () => {
    it('should return all enrollments for student under this teacher', async () => {
      const enrollments = [
        { id: 'e1', student_id: 's1', group_id: 'g1', status: 'active' },
        { id: 'e2', student_id: 's1', group_id: 'g2', status: 'active' }
      ];
      supabase.from.mockReturnValue(createChainable({ data: enrollments, error: null }));

      const result = await getStudentEnrollmentsForTeacher('s1', 'teacher-1');

      expect(result).toEqual(enrollments);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when student has no enrollments for teacher', async () => {
      supabase.from.mockReturnValue(createChainable({ data: [], error: null }));

      const result = await getStudentEnrollmentsForTeacher('s1', 'teacher-1');

      expect(result).toEqual([]);
    });

    it('should return empty array on error', async () => {
      supabase.from.mockReturnValue(createChainable({ data: null, error: { message: 'DB error' } }));

      const result = await getStudentEnrollmentsForTeacher('s1', 'teacher-1');

      expect(result).toEqual([]);
    });

    it('should filter by both student_id and teacher_id', async () => {
      const chain = createChainable({ data: [], error: null });
      supabase.from.mockReturnValue(chain);

      await getStudentEnrollmentsForTeacher('s1', 'teacher-1');

      expect(chain.eq).toHaveBeenCalledWith('student_id', 's1');
      expect(chain.eq).toHaveBeenCalledWith('teacher_id', 'teacher-1');
    });
  });

  describe('createStudentsQuery', () => {
    it('should return a chainable query', async () => {
      const chain = createChainable({ data: [], error: null, count: 0 });
      supabase.from.mockReturnValue(chain);

      const query = createStudentsQuery('teacher-1');

      expect(query).toBeDefined();
      expect(query.select).toBeDefined();
      expect(query.eq).toBeDefined();
      expect(query.order).toBeDefined();
    });

    it('should query students table with enrollment joins', async () => {
      const chain = createChainable({ data: [], error: null, count: 0 });
      supabase.from.mockReturnValue(chain);

      createStudentsQuery('teacher-1');

      expect(supabase.from).toHaveBeenCalledWith('students');
      const selectArg = chain.select.mock.calls[0][0];
      expect(selectArg).toContain('enrollments!inner');
      expect(selectArg).toContain('groups!inner');
      expect(selectArg).toContain('offerings!inner');
      expect(selectArg).toContain('parents');
    });

    it('should filter by teacher_id via enrollments', async () => {
      const chain = createChainable({ data: [], error: null, count: 0 });
      supabase.from.mockReturnValue(chain);

      createStudentsQuery('teacher-42');

      expect(chain.eq).toHaveBeenCalledWith('enrollments.teacher_id', 'teacher-42');
    });

    it('should order by created_at descending', async () => {
      const chain = createChainable({ data: [], error: null, count: 0 });
      supabase.from.mockReturnValue(chain);

      createStudentsQuery('teacher-1');

      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });
});
