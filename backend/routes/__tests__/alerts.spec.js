const request = require('supertest');
const express = require('express');

jest.mock('../../config/database', () => ({
  supabase: {
    from: jest.fn()
  },
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
  }
}));

jest.mock('../../middleware/validate', () => ({
  validate: () => (req, res, next) => {
    req.validated = req;
    next();
  }
}));

const alertsRouter = require('../alerts');
const { supabase, supabaseAdmin } = require('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/alerts', alertsRouter);
app.use(require('../../middleware/errorHandler'));

function createChainable(resolveWith) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolveWith),
    then: jest.fn().mockImplementation((resolve) => resolve(resolveWith))
  };
  return chain;
}

describe('Alerts Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/alerts/rules', () => {
    it('should return alert rules', async () => {
      const mockRules = [
        { id: 'r1', alert_type: 'attendance_threshold', threshold_value: 70, comparison: 'lt', notification_method: 'in_app' }
      ];

      supabase.from.mockReturnValue(createChainable({ data: mockRules, error: null }));

      const res = await request(app).get('/api/alerts/rules');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('should return empty array when no rules', async () => {
      supabase.from.mockReturnValue(createChainable({ data: [], error: null }));

      const res = await request(app).get('/api/alerts/rules');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      supabase.from.mockReturnValue(createChainable({ data: null, error: { message: 'DB error' } }));

      const res = await request(app).get('/api/alerts/rules');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/alerts/rules', () => {
    it('should create alert rule', async () => {
      const mockRule = { id: 'r1', alert_type: 'attendance_threshold', threshold_value: 70, comparison: 'lt', notification_method: 'in_app' };

      supabaseAdmin.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockRule, error: null })
          })
        })
      });

      const res = await request(app)
        .post('/api/alerts/rules')
        .send({ alert_type: 'attendance_threshold', threshold_value: 70, comparison: 'lt', notification_method: 'in_app' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.alert_type).toBe('attendance_threshold');
    });

    it('should return 500 on insert error', async () => {
      supabaseAdmin.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Insert failed' } })
          })
        })
      });

      const res = await request(app)
        .post('/api/alerts/rules')
        .send({ alert_type: 'attendance_threshold', threshold_value: 70, comparison: 'lt' });

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/alerts/rules/:id', () => {
    it('should update alert rule', async () => {
      const mockRule = { id: 'r1', alert_type: 'grade_threshold', threshold_value: 60, comparison: 'lt' };

      supabaseAdmin.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockRule, error: null })
              })
            })
          })
        })
      });

      const res = await request(app)
        .put('/api/alerts/rules/r1')
        .send({ threshold_value: 60 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 if rule not found', async () => {
      supabaseAdmin.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          })
        })
      });

      const res = await request(app)
        .put('/api/alerts/rules/nonexistent')
        .send({ threshold_value: 60 });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/alerts/rules/:id', () => {
    it('should delete alert rule', async () => {
      supabaseAdmin.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
          })
        })
      });

      const res = await request(app).delete('/api/alerts/rules/r1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Alert rule deleted');
    });

    it('should return 500 on delete error', async () => {
      supabaseAdmin.from.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockRejectedValue(new Error('DB error'))
          })
        })
      });

      const res = await request(app).delete('/api/alerts/rules/r1');

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/alerts/rules/:id/toggle', () => {
    it('should toggle alert rule enabled state', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { is_enabled: true }, error: null })
      });
      supabaseAdmin.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'r1', is_enabled: false }, error: null })
            })
          })
        })
      });

      const res = await request(app).put('/api/alerts/rules/r1/toggle');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('disabled');
    });

    it('should toggle from disabled to enabled', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { is_enabled: false }, error: null })
      });
      supabaseAdmin.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: { id: 'r1', is_enabled: true }, error: null })
            })
          })
        })
      });

      const res = await request(app).put('/api/alerts/rules/r1/toggle');

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('enabled');
    });

    it('should return 404 if rule not found', async () => {
      supabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      });

      const res = await request(app).put('/api/alerts/rules/nonexistent/toggle');

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/alerts', () => {
    it('should return paginated alerts', async () => {
      const mockAlerts = [
        { id: 'a1', severity: 'high', alert_type: 'attendance_threshold', is_read: false, students: { name: 'Ahmed', student_id: 'ST-001' } }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => resolve({ data: mockAlerts, error: null, count: 1 }))
      });

      const res = await request(app).get('/api/alerts');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(1);
    });

    it('should apply severity filter', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => resolve({ data: [], error: null, count: 0 }))
      };
      supabase.from.mockReturnValue(chain);

      await request(app).get('/api/alerts').query({ severity: 'high' });

      expect(chain.eq).toHaveBeenCalledWith('severity', 'high');
    });

    it('should apply unread_only filter', async () => {
      const chain = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => resolve({ data: [], error: null, count: 0 }))
      };
      supabase.from.mockReturnValue(chain);

      await request(app).get('/api/alerts').query({ unread_only: 'true' });

      expect(chain.eq).toHaveBeenCalledWith('is_read', false);
    });

    it('should strip students field and add student_name', async () => {
      const mockAlerts = [
        { id: 'a1', severity: 'high', students: { name: 'Ahmed', student_id: 'ST-001' } }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((resolve) => resolve({ data: mockAlerts, error: null, count: 1 }))
      });

      const res = await request(app).get('/api/alerts');

      expect(res.body.data[0].student_name).toBe('Ahmed');
      expect(res.body.data[0].student_code).toBe('ST-001');
      expect(res.body.data[0].students).toBeUndefined();
    });
  });

  describe('PUT /api/alerts/:id/read', () => {
    it('should mark alert as read', async () => {
      supabaseAdmin.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
          })
        })
      });

      const res = await request(app).put('/api/alerts/a1/read');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Alert marked as read');
    });

    it('should return 500 on update error', async () => {
      supabaseAdmin.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockRejectedValue(new Error('DB error'))
          })
        })
      });

      const res = await request(app).put('/api/alerts/a1/read');

      expect(res.status).toBe(500);
    });
  });

  describe('PUT /api/alerts/read-all', () => {
    it('should mark all alerts as read', async () => {
      supabaseAdmin.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null })
          })
        })
      });

      const res = await request(app).put('/api/alerts/read-all');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('All alerts marked as read');
    });

    it('should return 500 on update error', async () => {
      supabaseAdmin.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockRejectedValue(new Error('DB error'))
          })
        })
      });

      const res = await request(app).put('/api/alerts/read-all');

      expect(res.status).toBe(500);
    });
  });
});
