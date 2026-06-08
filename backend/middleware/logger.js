const logger = (winstonLogger) => {
  return (req, res, next) => {
    const start = Date.now();
    
    // Log request
    winstonLogger.info(`${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
      const duration = Date.now() - start;
      
      winstonLogger.info(`${req.method} ${req.url} - ${res.statusCode}`, {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`
      });
      
      originalEnd.call(this, chunk, encoding);
    };
    
    next();
  };
};

module.exports = logger;
