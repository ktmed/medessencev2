const { logRequest, logger } = require('../utils/logger');

/**
 * Request logging middleware
 */
const requestLogger = (req, res, next) => {
  // Start timer
  req.startTime = Date.now();
  
  // Generate request ID if not present
  if (!req.headers['x-request-id']) {
    req.headers['x-request-id'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Log incoming request
  logger.info('Incoming request', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: req.headers['x-request-id'],
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    referer: req.get('Referer'),
    timestamp: new Date().toISOString()
  });

  next();
};

/**
 * Response logging middleware
 */
const responseLogger = (req, res, next) => {
  // Capture original end method
  const originalEnd = res.end;
  
  // Override end method to log response
  res.end = function(chunk, encoding) {
    // Calculate response time
    const responseTime = Date.now() - req.startTime;
    
    // Log the request/response
    logRequest(req, res, responseTime);
    
    // Add response headers
    res.set('X-Request-ID', req.headers['x-request-id']);
    res.set('X-Response-Time', `${responseTime}ms`);
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

module.exports = {
  requestLogger,
  responseLogger
};