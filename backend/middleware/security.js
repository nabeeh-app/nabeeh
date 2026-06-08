const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Rate limiting middleware
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message || 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// General API rate limiting - DISABLED FOR DEVELOPMENT
// const apiLimiter = createRateLimit(
//   15 * 60 * 1000, // 15 minutes
//   100, // limit each IP to 100 requests per windowMs
//   'Too many API requests from this IP, please try again later.'
// );

// Disabled rate limiter for development
const apiLimiter = (req, res, next) => {
  next(); // Skip rate limiting
};

// Strict rate limiting for auth endpoints - DISABLED FOR DEVELOPMENT
// const authLimiter = createRateLimit(
//   15 * 60 * 1000, // 15 minutes
//   50, // limit each IP to 50 requests per windowMs (increased for development)
//   'Too many authentication attempts, please try again later.'
// );

// Disabled rate limiter for development
const authLimiter = (req, res, next) => {
  next(); // Skip rate limiting
};

// WhatsApp endpoint rate limiting - DISABLED FOR DEVELOPMENT
// const whatsappLimiter = createRateLimit(
//   60 * 1000, // 1 minute
//   10, // limit each IP to 10 requests per minute
//   'Too many WhatsApp requests, please try again later.'
// );

// Disabled rate limiter for development
const whatsappLimiter = (req, res, next) => {
  next(); // Skip rate limiting
};

// Security headers configuration
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.supabase.co", "https://generativelanguage.googleapis.com"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  // Remove potentially dangerous characters from string inputs
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  };

  // Sanitize body parameters
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
  }

  // Sanitize query parameters
  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key]);
      }
    }
  }

  next();
};

// Request logging middleware for security
const securityLogger = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    };

    // Log suspicious activities
    if (res.statusCode >= 400) {
      console.warn('Security Warning:', logData);
    }

    // Log slow requests
    if (duration > 5000) {
      console.warn('Slow Request:', logData);
    }
  });

  next();
};

module.exports = {
  apiLimiter,
  authLimiter,
  whatsappLimiter,
  securityHeaders,
  sanitizeInput,
  securityLogger
};
