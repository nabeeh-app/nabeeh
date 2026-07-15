const crypto = require('crypto');

const logger = (winstonLogger) => {
  return (req, res, next) => {
    const start = Date.now();
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.requestId = requestId;
    res.set('X-Request-Id', requestId);
    
    // Log request
    winstonLogger.info(`${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      requestId
    });
    
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - start;
      
      winstonLogger.info(`${req.method} ${req.url} - ${res.statusCode}`, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        requestId
      });
      
      originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
};

module.exports = logger;
