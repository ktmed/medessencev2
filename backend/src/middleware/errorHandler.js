const { logger, logError, logSecurityEvent } = require('../utils/logger');
const { createAuditLog } = require('../utils/audit');
const { 
  sanitizeError, 
  isSecurityIncident, 
  requiresGDPRAudit,
  HTTP_STATUS 
} = require('../utils/errors');

/**
 * Global error handler middleware
 */
const errorHandler = async (error, req, res, next) => {
  try {
    // Log the error
    logError(error, {
      userId: req.user?.id,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.headers['x-request-id']
    });

    // Handle security incidents
    if (isSecurityIncident(error)) {
      logSecurityEvent('SECURITY_INCIDENT', {
        error: error.message,
        code: error.code,
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        severity: 'high'
      });
    }

    // Handle GDPR audit requirements
    if (requiresGDPRAudit(error)) {
      await createAuditLog({
        userId: req.user?.id,
        action: 'GDPR_VIOLATION',
        resource: 'system',
        description: `GDPR compliance issue: ${error.message}`,
        method: req.method,
        endpoint: req.path,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        riskLevel: 'HIGH',
        flagged: true,
        reviewRequired: true
      });
    }

    // Determine status code
    const statusCode = error.statusCode || 
                       error.status || 
                       (error.name === 'ValidationError' ? 400 : 500);

    // Set security headers for error responses
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    });

    // Rate limiting headers for rate limit errors
    if (statusCode === 429 && error.retryAfter) {
      res.set('Retry-After', error.retryAfter);
    }

    // Sanitize error for client response
    const sanitizedError = sanitizeError(error);

    // Add correlation ID for tracking
    sanitizedError.correlationId = req.headers['x-request-id'] || 
                                   `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Add request context for debugging (non-production only)
    if (process.env.NODE_ENV !== 'production') {
      sanitizedError.debug = {
        method: req.method,
        path: req.path,
        headers: sanitizeHeaders(req.headers),
        query: req.query,
        params: req.params
      };
    }

    // Send error response
    res.status(statusCode).json(sanitizedError);

  } catch (handlerError) {
    // If error handler itself fails, log and send minimal response
    logger.error('Error handler failed:', handlerError);
    
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = async (req, res, next) => {
  try {
    // Log 404 attempts for security monitoring
    logger.warn('404 Not Found', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer')
    });

    // Create audit log for suspicious 404 patterns
    if (isSuspicious404(req)) {
      await createAuditLog({
        userId: req.user?.id,
        action: 'SUSPICIOUS_ACTIVITY',
        resource: 'system',
        description: `Suspicious 404 request: ${req.method} ${req.path}`,
        method: req.method,
        endpoint: req.path,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        riskLevel: 'MEDIUM',
        flagged: true
      });
    }

    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource was not found',
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Async error wrapper for route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler
 */
const validationErrorHandler = (error, req, res, next) => {
  if (error.name === 'ValidationError' || error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'Validation Error',
      message: 'Request validation failed',
      details: error.details || error.message,
      timestamp: new Date().toISOString()
    });
  }
  next(error);
};

/**
 * Database error handler
 */
const databaseErrorHandler = (error, req, res, next) => {
  // Prisma/Database specific errors
  if (error.code === 'P2002') {
    return res.status(409).json({
      error: 'Conflict',
      message: 'A record with this data already exists',
      field: error.meta?.target,
      timestamp: new Date().toISOString()
    });
  }

  if (error.code === 'P2025') {
    return res.status(404).json({
      error: 'Not Found',
      message: 'The requested record was not found',
      timestamp: new Date().toISOString()
    });
  }

  if (error.code?.startsWith('P2')) {
    logger.error('Database error:', error);
    return res.status(500).json({
      error: 'Database Error',
      message: 'A database error occurred',
      code: 'DATABASE_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  next(error);
};

/**
 * JWT error handler
 */
const jwtErrorHandler = (error, req, res, next) => {
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Invalid token',
      code: 'INVALID_TOKEN',
      timestamp: new Date().toISOString()
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Authentication Error',
      message: 'Token has expired',
      code: 'TOKEN_EXPIRED',
      timestamp: new Date().toISOString()
    });
  }

  next(error);
};

/**
 * Rate limit error handler
 */
const rateLimitErrorHandler = (error, req, res, next) => {
  if (error.statusCode === 429) {
    // Log rate limit violation
    logSecurityEvent('RATE_LIMIT_EXCEEDED', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      userId: req.user?.id,
      severity: 'medium'
    });

    return res.status(429).json({
      error: 'Rate Limit Exceeded',
      message: 'Too many requests. Please try again later.',
      retryAfter: error.retryAfter || 900,
      timestamp: new Date().toISOString()
    });
  }

  next(error);
};

/**
 * Sanitize headers to remove sensitive information
 */
const sanitizeHeaders = (headers) => {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
};

/**
 * Check if 404 request is suspicious
 */
const isSuspicious404 = (req) => {
  const suspiciousPatterns = [
    /\.(php|asp|jsp|cgi)$/i,
    /\/wp-admin/i,
    /\/admin/i,
    /\/phpmyadmin/i,
    /\/\.env/i,
    /\/\.git/i,
    /\/config/i,
    /\/backup/i,
    /\/test/i,
    /\/debug/i
  ];

  return suspiciousPatterns.some(pattern => pattern.test(req.path));
};

/**
 * Error monitoring and alerting
 */
const monitorError = async (error, req) => {
  // Count error occurrences for alerting
  const errorKey = `${error.name}_${error.code || 'UNKNOWN'}`;
  
  // In production, you might want to send alerts for:
  // - High error rates
  // - Security incidents
  // - Service unavailability
  // - Database errors
  
  if (error.statusCode >= 500) {
    // Server errors should trigger immediate alerts
    logger.error('Server error detected', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Setup error handling middleware stack
 */
const setupErrorHandling = (app) => {
  // Specific error handlers (order matters)
  app.use(rateLimitErrorHandler);
  app.use(jwtErrorHandler);
  app.use(validationErrorHandler);
  app.use(databaseErrorHandler);
  
  // 404 handler
  app.use(notFoundHandler);
  
  // Global error handler (must be last)
  app.use(errorHandler);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  validationErrorHandler,
  databaseErrorHandler,
  jwtErrorHandler,
  rateLimitErrorHandler,
  setupErrorHandling,
  sanitizeHeaders,
  isSuspicious404,
  monitorError
};