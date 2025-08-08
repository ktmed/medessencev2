const logger = require('../utils/logger');
const { auditLogger } = require('../utils/audit');

const auditMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  const originalJson = res.json;

  // Capture response data
  let responseData;
  
  res.send = function(data) {
    responseData = data;
    originalSend.call(this, data);
  };

  res.json = function(data) {
    responseData = data;
    originalJson.call(this, data);
  };

  // Log request
  auditLogger.logRequest({
    method: req.method,
    url: req.url,
    path: req.path,
    query: req.query,
    body: req.body,
    headers: req.headers,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Log response after request completes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    auditLogger.logResponse({
      method: req.method,
      url: req.url,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      responseData: responseData && res.statusCode < 400 ? responseData : undefined,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });

    // Log errors
    if (res.statusCode >= 400) {
      auditLogger.logError({
        method: req.method,
        url: req.url,
        path: req.path,
        statusCode: res.statusCode,
        error: responseData,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      });
    }
  });

  next();
};

module.exports = {
  auditMiddleware
};