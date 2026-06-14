const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Nabeeh API',
      version: '1.0.0',
      description: 'Bilingual (AR/EN) smart teaching assistant API — classroom management, student tracking, attendance, grade management, and parent communication via WhatsApp.',
      contact: {
        name: 'Nabeeh Team',
        url: 'https://nabeeh-ai.com',
      },
    },
    servers: [
      { url: 'http://localhost:5000', description: 'Local development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token from /api/auth/login',
        },
      },
      schemas: {
        SuccessEnvelope: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { description: 'Response payload' },
          },
        },
        ErrorEnvelope: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            code: { type: 'string' },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            pages: { type: 'integer' },
          },
        },
        Teacher: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            phone: { type: 'string' },
            role: { type: 'string', enum: ['teacher', 'admin'] },
            business_name: { type: 'string', nullable: true },
            bio: { type: 'string', nullable: true },
            subjects: { type: 'array', items: { type: 'string' }, nullable: true },
            whatsapp_number: { type: 'string', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Student: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            student_code: { type: 'string' },
            phone: { type: 'string', nullable: true },
            teacher_id: { type: 'string', format: 'uuid' },
            is_demo: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Parent: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            phone: { type: 'string' },
            email: { type: 'string', format: 'email', nullable: true },
            relationship: { type: 'string', enum: ['father', 'mother', 'guardian', 'grandmother', 'grandfather', 'uncle', 'aunt', 'other'] },
            is_primary: { type: 'boolean' },
            preferred_language: { type: 'string', enum: ['ar', 'en'] },
            student_id: { type: 'string', format: 'uuid' },
          },
        },
        Offering: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            academic_year: { type: 'string' },
            is_active: { type: 'boolean' },
            subject: { type: 'object' },
            grade_level: { type: 'object' },
            groups: { type: 'array' },
          },
        },
        Group: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            max_capacity: { type: 'integer' },
            schedule_description: { type: 'string', nullable: true },
          },
        },
        AttendanceRecord: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['present', 'absent', 'late', 'excused'] },
            date: { type: 'string', format: 'date' },
            notes: { type: 'string', nullable: true },
            enrollment_id: { type: 'string', format: 'uuid' },
          },
        },
        Grade: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            score: { type: 'number' },
            max_score: { type: 'number' },
            assessment_name: { type: 'string' },
            student_id: { type: 'string', format: 'uuid' },
            student_name: { type: 'string' },
            subject: { type: 'string' },
            date: { type: 'string', format: 'date' },
            notes: { type: 'string', nullable: true },
          },
        },
        AlertRule: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            alert_type: { type: 'string', enum: ['attendance_threshold', 'grade_threshold', 'trend_anomaly'] },
            threshold_value: { type: 'number' },
            comparison: { type: 'string', enum: ['gt', 'lt', 'gte', 'lte'] },
            notification_method: { type: 'string', enum: ['in_app', 'whatsapp', 'both'] },
            is_enabled: { type: 'boolean' },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            type: { type: 'string' },
            title: { type: 'string' },
            body: { type: 'string' },
            is_read: { type: 'boolean' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [
      { bearerAuth: [] },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication & registration' },
      { name: 'Teachers', description: 'Teacher profile & settings' },
      { name: 'Students', description: 'Student CRUD & stats' },
      { name: 'Parents', description: 'Parent contact management' },
      { name: 'Attendance', description: 'Attendance marking & queries' },
      { name: 'Grades', description: 'Grade management & bulk import' },
      { name: 'Offerings', description: 'Course offerings & groups' },
      { name: 'Messages', description: 'Conversations & message history' },
      { name: 'Assistants', description: 'Assistant management & permissions' },
      { name: 'Import', description: 'CSV/Excel student import' },
      { name: 'Self Registration', description: 'Student self-registration links' },
      { name: 'WhatsApp', description: 'WhatsApp bot & messaging' },
      { name: 'Alerts', description: 'Alert rules & triggered alerts' },
      { name: 'Notifications', description: 'In-app notifications' },
      { name: 'Reports', description: 'AI-generated report comments' },
      { name: 'Grade Analysis', description: 'Analytics, distributions & trends' },
    ],
  },
  apis: [
    path.join(__dirname, '..', 'routes', '*.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
