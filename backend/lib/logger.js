const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Render Free has an ephemeral filesystem and may start without logs/.
// Ensure the dir exists so File transports never crash the boot.
try {
  fs.mkdirSync(path.join(__dirname, '..', 'logs'), { recursive: true });
} catch { /* console transport still works */ }

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
const originalChild = logger.child.bind(logger);
logger.child = (bindings) => {
  const child = originalChild(bindings);
  child.trace = child.debug;
  return child;
};

module.exports = logger;
