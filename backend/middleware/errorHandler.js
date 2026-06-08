const logger = require('../lib/logger');

const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });

  // PostgreSQL error codes
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      message: 'Resource already exists',
      code: 'DUPLICATE_ENTRY'
    });
  }

  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced resource not found',
      code: 'FK_VIOLATION'
    });
  }

  if (err.code === '22P02') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      code: 'INVALID_UUID'
    });
  }

  // Supabase PostgREST: row not found
  if (err.code === 'PGRST116') {
    return res.status(404).json({
      success: false,
      message: 'Resource not found',
      code: 'NOT_FOUND'
    });
  }

  // Supabase RLS: insufficient privilege
  if (err.code === '42501') {
    return res.status(403).json({
      success: false,
      message: 'Access denied',
      code: 'INSUFFICIENT_PRIVILEGE'
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
