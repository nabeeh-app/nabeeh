const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const winston = require('winston');

// Load environment variables
dotenv.config();

// Import routes
const authRoutes = require('./routes/auth');
const teacherRoutes = require('./routes/teachers');
const studentRoutes = require('./routes/students');
const parentRoutes = require('./routes/parents');
const attendanceRoutes = require('./routes/attendance');
const gradeRoutes = require('./routes/grades');
const messageRoutes = require('./routes/messages');
const offeringRoutes = require('./routes/offerings');
const { router: whatsappRoutes } = require('./routes/whatsapp');

// Create a router for WhatsApp routes
const whatsappRouter = express.Router();
whatsappRouter.use(whatsappRoutes);

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');
const {
  apiLimiter,
  authLimiter,
  whatsappLimiter,
  securityHeaders,
  sanitizeInput,
  securityLogger
} = require('./middleware/security');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;
app.disable('etag');

// Configure Winston logger
const winstonLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'nabeeh-backend' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Global middleware
app.use(securityHeaders); // Enhanced security headers
app.use(cors({
  origin: true, // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
})); // Enable CORS
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
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

// API routes with specific rate limiting
app.use('/api/auth', authRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/offerings', offeringRoutes);

// WhatsApp routes with rate limiting
app.use('/api/whatsapp', whatsappLimiter, (req, res, next) => {
  console.log('WhatsApp route middleware:', {
    method: req.method,
    url: req.url,
    originalUrl: req.originalUrl
  });
  next();
});
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
const server = app.listen(PORT, () => {
  winstonLogger.info(`🚀 Nabeeh Backend Server running on port ${PORT}`);
  winstonLogger.info(`📚 Environment: ${process.env.NODE_ENV}`);
  winstonLogger.info(`🔗 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  winstonLogger.info(`${signal} received, shutting down gracefully...`);

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
