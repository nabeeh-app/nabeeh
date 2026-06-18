const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import Swagger config
const swaggerSpec = require('./config/swagger');
const swaggerUi = require('swagger-ui-express');

// Import routes
const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teachers');
const studentRoutes = require('./routes/students');
const parentRoutes = require('./routes/parents');
const attendanceRoutes = require('./routes/attendance');
const gradeRoutes = require('./routes/grades');
const messageRoutes = require('./routes/messages');
const offeringRoutes = require('./routes/offerings');
const assistantRoutes = require('./routes/assistants');
const importRoutes = require('./routes/import');
const selfRegistrationRoutes = require('./routes/selfRegistration');
const { router: whatsappRoutes } = require('./routes/whatsapp');
const alertRoutes = require('./routes/alerts');
const notificationRoutes = require('./routes/notifications');
const reportRoutes = require('./routes/reports');
const gradeAnalysisRoutes = require('./routes/gradeAnalysis');

// Create a router for WhatsApp routes
const whatsappRouter = express.Router();
whatsappRouter.use(whatsappRoutes);

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');
const { authenticateToken, requireRole } = require('./middleware/auth');
const {
  apiLimiter,
  authLimiter,
  whatsappLimiter,
  securityHeaders,
  sanitizeInput,
  securityLogger,
  csrfGenerate,
  csrfValidate
} = require('./middleware/security');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;
app.disable('etag');

// Configure Winston logger
const winstonLogger = require('./lib/logger');

// Global middleware
app.use(securityHeaders); // Enhanced security headers
app.use(cors({
  origin: (process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  credentials: true
})); // Enable CORS
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies
app.use(csrfGenerate); // Generate CSRF token cookie for authenticated requests
app.use(sanitizeInput); // Input sanitization
app.use(securityLogger); // Security logging
app.use(logger(winstonLogger)); // Custom logging middleware
app.use(apiLimiter); // General API rate limiting

// Health check endpoints (both /health and /api/health)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * @openapi
 * /api/admin/whatsapp-health:
 *   get:
 *     tags: [WhatsApp]
 *     summary: Get WhatsApp connection status (admin only)
 *     description: Returns the current WhatsApp session status. Requires admin role.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Status retrieved
 *       401:
 *         $ref: '#/components/schemas/ErrorEnvelope'
 *       403:
 *         $ref: '#/components/schemas/ErrorEnvelope'
 */
app.get('/api/admin/whatsapp-health', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const sessionManager = require('./lib/sessionManager');
    const sessions = Array.from(sessionManager.sessions.entries()).map(([teacherId, session]) => ({
      teacherId,
      status: session.client.getStatus().status || 'disconnected',
      phone: session.client.getStatus().phone || null,
      lastActive: session.lastActive ? new Date(session.lastActive).toISOString() : null
    }));

    res.json({
      success: true,
      data: {
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.status === 'connected').length,
        sessions,
        lastCheck: new Date().toISOString()
      }
    });
  } catch (error) {
    res.json({
      success: true,
      data: {
        totalSessions: 0,
        activeSessions: 0,
        sessions: [],
        lastCheck: new Date().toISOString()
      }
    });
  }
});

// API Documentation — admin-only in production
const swaggerAuth = process.env.NODE_ENV === 'production'
  ? [authenticateToken, requireRole('admin')]
  : [];

app.use('/api-docs', ...swaggerAuth, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Nabeeh API Docs',
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'list',
    filter: true,
  },
}));

// Serve raw OpenAPI spec
app.get('/api-docs.json', ...swaggerAuth, (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use(csrfValidate); // Validate CSRF token on state-changing requests

// API routes with specific rate limiting
if (process.env.USE_MOCK_DB === 'true') {
  const mockRoutes = require('./routes/mock');
  app.use('/api', mockRoutes);
  winstonLogger.info('📦 Using mock data routes (USE_MOCK_DB=true)');
} else {
  app.use('/api/auth', authRoutes);
  app.use('/api/teachers', teacherRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/parents', parentRoutes);
  app.use('/api/attendance', attendanceRoutes);
  app.use('/api/grades', gradeRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/offerings', offeringRoutes);
  app.use('/api/assistants', assistantRoutes);
  app.use('/api/import', importRoutes);
  app.use('/api/students/self-register', selfRegistrationRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/grade-analysis', gradeAnalysisRoutes);
}

// WhatsApp routes with rate limiting
app.use('/api/whatsapp', whatsappLimiter, whatsappRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use(errorHandler);

// Start server
const server = app.listen(PORT, async () => {
  winstonLogger.info(`🚀 Nabeeh Backend Server running on port ${PORT}`);
  winstonLogger.info(`📚 Environment: ${process.env.NODE_ENV}`);
  winstonLogger.info(`🔗 Health check: http://localhost:${PORT}/health`);

  // Start cron jobs
  const { startCronJobs } = require('./lib/cron');
  startCronJobs();

  // Initialize WhatsApp session manager (connects all teacher sessions)
  const sessionManager = require('./lib/sessionManager');
  sessionManager.start().catch((err) => {
    winstonLogger.error('WhatsApp session manager start failed', { error: err.message });
  });
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  winstonLogger.info(`${signal} received, shutting down gracefully...`);

  // Stop WhatsApp session manager
  const sessionManager = require('./lib/sessionManager');
  await sessionManager.stop().catch((err) => {
    winstonLogger.error('Error stopping session manager', { error: err.message });
  });

  // Stop accepting new connections
  server.close(() => {
    winstonLogger.info('HTTP server closed');

    // Close database connections if any
    // Add your database cleanup here if needed

    winstonLogger.info('Graceful shutdown completed');
    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    winstonLogger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle different termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  winstonLogger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  winstonLogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

module.exports = app;
