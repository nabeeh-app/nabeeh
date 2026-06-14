const request = require('supertest');
const express = require('express');

jest.mock('../../config/database', () => ({
  supabaseAdmin: {
    from: jest.fn()
  }
}));

jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { id: 'teacher-1', email: 'test@example.com', role: 'teacher' };
    next();
  },
  requirePermission: () => (req, res, next) => next()
}));

jest.mock('../../middleware/validate', () => ({
  validate: () => (req, res, next) => next(),
  createStudentSchema: {},
  updateStudentSchema: {}
}));

const studentsRouter = require('../students');
const { supabaseAdmin } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/students', studentsRouter);

function createChainable(resolveWith) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveWith),
    then: jest.fn().mockImplementation((resolve) => resolve(resolveWith))
  };
  return chain;
}

describe('Students Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/students', () => {
    it('should return paginated students', async () => {
      const mockStudents = [
        { id: 's1', name: 'Ahmed Ali', student_code: 'ST-001', phone: '+201234567890' },
        { id: 's2', name: 'Sara Mohamed', student_code: 'ST-002', phone: '+201234567891' }
      ];

      supabaseAdmin.from.mockReturnValue(createChainable({ data: mockStudents, error: null, count: 2 }));

      const res = await request(app).get('/api/students');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.limit).toBe(10);
      expect(res.body.pagination.total).toBe(2);
    });

    it('should call ilike with search parameter', async () => {
      const chain = createChainable({ data: [], error: null, count: 0 });
      supabaseAdmin.from.mockReturnValue(chain);

      const res = await request(app)
        .get('/api/students')
        .query({ search: 'Ahmed' });

      expect(res.status).toBe(200);
      expect(chain.ilike).toHaveBeenCalledWith('name', '%Ahmed%');
    });

    it('should apply group_id filter when provided', async () => {
      const chain = createChainable({ data: [], error: null, count: 0 });
      supabaseAdmin.from.mockReturnValue(chain);

      await request(app)
        .get('/api/students')
        .query({ group_id: 'g1' });

      expect(chain.eq).toHaveBeenCalledWith('enrollments.group_id', 'g1');
    });

    it('should apply enrollment status filter', async () => {
      const chain = createChainable({ data: [], error: null, count: 0 });
      supabaseAdmin.from.mockReturnValue(chain);

      await request(app)
        .get('/api/students')
        .query({ status: 'inactive' });

      expect(chain.eq).toHaveBeenCalledWith('enrollments.status', 'inactive');
    });

    it('should use correct select with enrollment joins', async () => {
      const chain = createChainable({ data: [], error: null, count: 0 });
      supabaseAdmin.from.mockReturnValue(chain);

      await request(app).get('/api/students');

      expect(supabaseAdmin.from).toHaveBeenCalledWith('students');
      const selectArg = chain.select.mock.calls[0][0];
      expect(selectArg).toContain('enrollments!inner');
      expect(selectArg).toContain('groups!inner');
      expect(selectArg).toContain('offerings!inner');
      expect(selectArg).toContain('parents');
    });

    it('should return 400 on database error', async () => {
      supabaseAdmin.from.mockReturnValue(createChainable({ data: null, error: { message: 'DB error' }, count: null }));

      const res = await request(app).get('/api/students');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/students/:id', () => {
    it('should return a single student with nested data', async () => {
      const mockStudent = {
        id: 's1',
        name: 'Ahmed Ali',
        student_code: 'ST-001',
        parents: [],
        enrollments: []
      };

      supabaseAdmin.from.mockReturnValue(createChainable({ data: mockStudent, error: null }));

      const res = await request(app).get('/api/students/s1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Ahmed Ali');
      expect(res.body.data.parents).toBeDefined();
      expect(res.body.data.enrollments).toBeDefined();
    });

    it('should use correct select with attendance and grade joins', async () => {
      const chain = createChainable({ data: null, error: { message: 'Not found' } });
      supabaseAdmin.from.mockReturnValue(chain);

      await request(app).get('/api/students/s1');

      const selectArg = chain.select.mock.calls[0][0];
      expect(selectArg).toContain('enrollments!inner');
      expect(selectArg).toContain('attendance');
      expect(selectArg).toContain('grades');
      expect(selectArg).toContain('assessments');
    });

    it('should return 404 for non-existent student', async () => {
      supabaseAdmin.from.mockReturnValue(createChainable({ data: null, error: { message: 'Not found' } }));

      const res = await request(app).get('/api/students/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/students', () => {
    it('should create a student and enroll in group', async () => {
      const mockStudent = { id: 's1', name: 'New Student', student_code: 'ST-003' };

      const groupCheckChain = createChainable({
        data: { offering: { teacher_id: 'teacher-1' } },
        error: null
      });

      const insertChain = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockStudent, error: null })
          })
        })
      };

      const enrollChain = {
        insert: jest.fn().mockResolvedValue({ error: null })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(groupCheckChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(enrollChain);

      const res = await request(app)
        .post('/api/students')
        .send({
          name: 'New Student',
          group_id: '550e8400-e29b-41d4-a716-446655440000',
          phone: '+201234567890'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('New Student');
    });

    it('should create parents when provided', async () => {
      const mockStudent = { id: 's1', name: 'New Student', student_code: 'ST-003' };

      const groupCheckChain = createChainable({
        data: { offering: { teacher_id: 'teacher-1' } },
        error: null
      });

      const insertChain = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockStudent, error: null })
          })
        })
      };

      const enrollChain = {
        insert: jest.fn().mockResolvedValue({ error: null })
      };

      const parentsChain = {
        insert: jest.fn().mockResolvedValue({ error: null })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(groupCheckChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(enrollChain)
        .mockReturnValueOnce(parentsChain);

      const res = await request(app)
        .post('/api/students')
        .send({
          name: 'New Student',
          group_id: '550e8400-e29b-41d4-a716-446655440000',
          parents: [
            { name: 'Parent 1', phone: '+201111111111', relationship: 'mother', is_primary: true }
          ]
        });

      expect(res.status).toBe(201);
      expect(parentsChain.insert).toHaveBeenCalled();
      const parentsData = parentsChain.insert.mock.calls[0][0];
      expect(parentsData).toHaveLength(1);
      expect(parentsData[0].name).toBe('Parent 1');
      expect(parentsData[0].student_id).toBe('s1');
    });

    it('should return 403 if group belongs to another teacher', async () => {
      const groupCheckChain = createChainable({
        data: { offering: { teacher_id: 'other-teacher' } },
        error: null
      });

      supabaseAdmin.from.mockReturnValueOnce(groupCheckChain);

      const res = await request(app)
        .post('/api/students')
        .send({
          name: 'New Student',
          group_id: '550e8400-e29b-41d4-a716-446655440000',
          phone: '+201234567890'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Unauthorized to add to this group');
    });

    it('should return 403 if group does not exist', async () => {
      const groupCheckChain = createChainable({ data: null, error: null });
      supabaseAdmin.from.mockReturnValueOnce(groupCheckChain);

      const res = await request(app)
        .post('/api/students')
        .send({
          name: 'New Student',
          group_id: '550e8400-e29b-41d4-a716-446655440000',
          phone: '+201234567890'
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/students')
        .send({ phone: '+201234567890' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 if student insert fails', async () => {
      const groupCheckChain = createChainable({
        data: { offering: { teacher_id: 'teacher-1' } },
        error: null
      });

      const insertChain = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } })
          })
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(groupCheckChain)
        .mockReturnValueOnce(insertChain);

      const res = await request(app)
        .post('/api/students')
        .send({
          name: 'New Student',
          group_id: '550e8400-e29b-41d4-a716-446655440000'
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 if enrollment insert fails', async () => {
      const groupCheckChain = createChainable({
        data: { offering: { teacher_id: 'teacher-1' } },
        error: null
      });

      const mockStudent = { id: 's1', name: 'New Student' };
      const insertChain = {
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockStudent, error: null })
          })
        })
      };

      const enrollChain = {
        insert: jest.fn().mockResolvedValue({ error: { message: 'Enrollment failed' } })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(groupCheckChain)
        .mockReturnValueOnce(insertChain)
        .mockReturnValueOnce(enrollChain);

      const res = await request(app)
        .post('/api/students')
        .send({
          name: 'New Student',
          group_id: '550e8400-e29b-41d4-a716-446655440000'
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/students/:id', () => {
    it('should update a student', async () => {
      const countChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ count: 1, error: null });
        })
      };

      const updateChain = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 's1', name: 'Updated Name' },
                error: null
              })
            })
          })
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateChain);

      const res = await request(app)
        .put('/api/students/550e8400-e29b-41d4-a716-446655440000')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Updated Name');
    });

    it('should only allow updating allowed fields', async () => {
      const countChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ count: 1, error: null });
        })
      };

      const updateChain = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { id: 's1', name: 'Updated' },
                error: null
              })
            })
          })
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateChain);

      await request(app)
        .put('/api/students/550e8400-e29b-41d4-a716-446655440000')
        .send({ name: 'Updated', email: 'hacker@evil.com', role: 'admin' });

      const updateCall = updateChain.update.mock.calls[0][0];
      expect(updateCall.name).toBe('Updated');
      expect(updateCall.email).toBeUndefined();
      expect(updateCall.role).toBeUndefined();
    });

    it('should return 403 if student has no enrollment for this teacher', async () => {
      const countChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ count: 0, error: null });
        })
      };

      supabaseAdmin.from.mockReturnValueOnce(countChain);

      const res = await request(app)
        .put('/api/students/550e8400-e29b-41d4-a716-446655440000')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 if update fails', async () => {
      const countChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ count: 1, error: null });
        })
      };

      const updateChain = {
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Update failed' }
              })
            })
          })
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(countChain)
        .mockReturnValueOnce(updateChain);

      const res = await request(app)
        .put('/api/students/550e8400-e29b-41d4-a716-446655440000')
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/students/:id', () => {
    it('should delete student enrollments', async () => {
      const findChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [{ id: 'e1' }], error: null });
        })
      };

      const deleteChain = {
        delete: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ error: null })
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(deleteChain);

      const res = await request(app).delete('/api/students/s1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Student removed from your classes');
      expect(res.body.data).toBeUndefined();
    });

    it('should return 404 if student not in teacher classes', async () => {
      const findChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [], error: null });
        })
      };

      supabaseAdmin.from.mockReturnValueOnce(findChain);

      const res = await request(app).delete('/api/students/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 500 if enrollment delete fails', async () => {
      const findChain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => {
          resolve({ data: [{ id: 'e1' }], error: null });
        })
      };

      const deleteChain = {
        delete: jest.fn().mockReturnValue({
          in: jest.fn().mockResolvedValue({ error: { message: 'Delete failed' } })
        })
      };

      supabaseAdmin.from
        .mockReturnValueOnce(findChain)
        .mockReturnValueOnce(deleteChain);

      const res = await request(app).delete('/api/students/s1');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/students/:id/stats', () => {
    it('should return attendance and academic stats', async () => {
      const enrollmentsChain = createChainable({
        data: [
          { id: 'e1', group: { offering: { teacher_id: 'teacher-1' } } },
          { id: 'e2', group: { offering: { teacher_id: 'teacher-1' } } }
        ],
        error: null
      });

      const attendanceChain = createChainable({
        data: [
          { status: 'present' },
          { status: 'present' },
          { status: 'absent' },
          { status: 'late' }
        ],
        error: null
      });

      const gradesChain = createChainable({
        data: [
          { score: 85, assessment: { max_score: 100 } },
          { score: 90, assessment: { max_score: 100 } }
        ],
        error: null
      });

      supabaseAdmin.from
        .mockReturnValueOnce(enrollmentsChain)
        .mockReturnValueOnce(attendanceChain)
        .mockReturnValueOnce(gradesChain);

      const res = await request(app).get('/api/students/s1/stats');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.attendance).toBeDefined();
      expect(res.body.data.academic).toBeDefined();

      expect(res.body.data.attendance.present).toBe(2);
      expect(res.body.data.attendance.absent).toBe(1);
      expect(res.body.data.attendance.late).toBe(1);
      expect(res.body.data.attendance.total_days).toBe(4);
      expect(res.body.data.attendance.attendance_percentage).toBe(75);

      expect(res.body.data.academic.total_assessments).toBe(2);
      expect(res.body.data.academic.average_score).toBe(87.5);
    });

    it('should return zeros when student has no attendance or grades', async () => {
      const enrollmentsChain = createChainable({
        data: [{ id: 'e1', group: { offering: { teacher_id: 'teacher-1' } } }],
        error: null
      });

      const attendanceChain = createChainable({ data: [], error: null });
      const gradesChain = createChainable({ data: [], error: null });

      supabaseAdmin.from
        .mockReturnValueOnce(enrollmentsChain)
        .mockReturnValueOnce(attendanceChain)
        .mockReturnValueOnce(gradesChain);

      const res = await request(app).get('/api/students/s1/stats');

      expect(res.status).toBe(200);
      expect(res.body.data.attendance.total_days).toBe(0);
      expect(res.body.data.attendance.attendance_percentage).toBe(0);
      expect(res.body.data.academic.average_score).toBe(0);
      expect(res.body.data.academic.total_assessments).toBe(0);
    });

    it('should return 404 if student has no enrollments for this teacher', async () => {
      const enrollmentsChain = createChainable({ data: [], error: null });
      supabaseAdmin.from.mockReturnValueOnce(enrollmentsChain);

      const res = await request(app).get('/api/students/s1/stats');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should return 404 on enrollment query error', async () => {
      const enrollmentsChain = createChainable({ data: null, error: { message: 'DB error' } });
      supabaseAdmin.from.mockReturnValueOnce(enrollmentsChain);

      const res = await request(app).get('/api/students/s1/stats');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should handle grades with null max_score', async () => {
      const enrollmentsChain = createChainable({
        data: [{ id: 'e1', group: { offering: { teacher_id: 'teacher-1' } } }],
        error: null
      });

      const attendanceChain = createChainable({ data: [], error: null });
      const gradesChain = createChainable({
        data: [
          { score: 85, assessment: { max_score: null } },
          { score: 90, assessment: { max_score: 100 } }
        ],
        error: null
      });

      supabaseAdmin.from
        .mockReturnValueOnce(enrollmentsChain)
        .mockReturnValueOnce(attendanceChain)
        .mockReturnValueOnce(gradesChain);

      const res = await request(app).get('/api/students/s1/stats');

      expect(res.status).toBe(200);
      expect(res.body.data.academic.total_assessments).toBe(2);
    });
  });
});
