const winston = require('winston');

const logger = winston.createLogger({
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

// Baileys v7 requires pino-compatible logger with trace/debug methods
logger.trace = logger.debug;
logger.child = (bindings) => {
  const child = logger.child(bindings);
  child.trace = child.debug;
  return child;
};

module.exports = logger;
