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
    req.user = { id: 'assistant-1', email: 'assistant@example.com', role: 'assistant', teacherId: 'owner-1' };
    next();
  },
  requirePermission: () => (req, res, next) => next(),
  requireRole: () => (req, res, next) => next()
}));

jest.mock('../../middleware/validate', () => ({
  validate: () => (req, res, next) => {
    req.validated = { body: req.body, query: req.query, params: req.params };
    next();
  },
  createOfferingSchema: {},
  createGroupSchema: {},
  updateGroupSchema: {},
  enrollStudentSchema: {}
}));

jest.mock('../../lib/enrollmentChain', () => ({
  createStudentsQuery: jest.fn(),
  verifyStudentAccess: jest.fn(),
  verifyGroupAccess: jest.fn()
}));

jest.mock('../../lib/privileged/tenantClient', () => {
  const db = require('../../config/database');
  return { scopedClient: () => db.supabaseAdmin };
});

const studentsRouter = require('../students');
const offeringsRouter = require('../offerings');
const { supabaseAdmin } = require('../../config/database');
const { createStudentsQuery, verifyStudentAccess } = require('../../lib/enrollmentChain');
const errorHandler = require('../../middleware/errorHandler');

const app = express();
app.use(express.json());
app.use('/api/students', studentsRouter);
app.use('/api/offerings', offeringsRouter);
app.use(errorHandler);

function createChainable(resolveWith) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveWith),
    then: jest.fn().mockImplementation((resolve) => resolve(resolveWith))
  };
  return chain;
}

describe('Tenant scoping for assistants', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists the owner teacher students, not the assistant own id', async () => {
    createStudentsQuery.mockReturnValue(createChainable({ data: [], error: null, count: 0 }));

    await request(app).get('/api/students').expect(200);

    expect(createStudentsQuery).toHaveBeenCalledWith(expect.anything(), 'owner-1');
  });

  it('verifies enrollment against the owner teacher id', async () => {
    verifyStudentAccess.mockResolvedValue({ id: 'enr-1' });
    supabaseAdmin.from.mockReturnValue(createChainable({ data: { id: 'off-1' }, error: null }));

    await request(app)
      .post('/api/offerings/off-1/groups/grp-1/enroll')
      .send({ student_id: 'stu-1' });

    expect(verifyStudentAccess).toHaveBeenCalledWith(expect.anything(), 'stu-1', 'owner-1');
  });

  it('rejects enrollment of a foreign student with 404', async () => {
    verifyStudentAccess.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/offerings/off-1/groups/grp-1/enroll')
      .send({ student_id: 'foreign-student' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
