const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');

// Ensure log directory exists
const logDir = config.logging.dir;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create subdirectories for different log types
const subDirs = ['audit', 'medical', 'security', 'performance'];
subDirs.forEach(dir => {
  const fullPath = path.join(logDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// Custom format for development
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      log += `\n  ${JSON.stringify(meta, null, 2)}`;
    }
    
    if (stack) {
      log += `\n${stack}`;
    }
    
    return log;
  })
);

// Custom format for production
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    // Sanitize sensitive information
    const sanitized = { ...info };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'apiKey', 'authorization', 'cookie'];
    const sanitizeObject = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      
      const sanitized = { ...obj };
      for (const key in sanitized) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof sanitized[key] === 'object') {
          sanitized[key] = sanitizeObject(sanitized[key]);
        }
      }
      return sanitized;
    };

    return JSON.stringify(sanitizeObject(sanitized));
  })
);

// Transport configuration
const transports = [
  // Console transport
  new winston.transports.Console({
    format: config.nodeEnv === 'production' ? productionFormat : developmentFormat,
    level: config.logging.level
  }),

  // General application logs
  new DailyRotateFile({
    filename: path.join(logDir, 'application-%DATE%.log'),
    datePattern: config.logging.datePattern,
    maxSize: config.logging.maxSize,
    maxFiles: config.logging.maxFiles,
    format: productionFormat,
    level: 'info'
  }),

  // Error logs
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: config.logging.datePattern,
    maxSize: config.logging.maxSize,
    maxFiles: config.logging.maxFiles,
    format: productionFormat,
    level: 'error'
  }),

  // Security logs
  new DailyRotateFile({
    filename: path.join(logDir, 'security', 'security-%DATE%.log'),
    datePattern: config.logging.datePattern,
    maxSize: config.logging.maxSize,
    maxFiles: config.logging.maxFiles,
    format: productionFormat,
    level: 'warn'
  }),

  // Audit logs (GDPR compliance)
  new DailyRotateFile({
    filename: path.join(logDir, 'audit', 'audit-%DATE%.log'),
    datePattern: config.logging.datePattern,
    maxSize: config.logging.maxSize,
    maxFiles: '2555d', // 7 years for medical compliance
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),

  // Medical data access logs
  new DailyRotateFile({
    filename: path.join(logDir, 'medical', 'medical-access-%DATE%.log'),
    datePattern: config.logging.datePattern,
    maxSize: config.logging.maxSize,
    maxFiles: '3650d', // 10 years for medical compliance
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),

  // Performance logs
  new DailyRotateFile({
    filename: path.join(logDir, 'performance', 'performance-%DATE%.log'),
    datePattern: config.logging.datePattern,
    maxSize: config.logging.maxSize,
    maxFiles: config.logging.maxFiles,
    format: productionFormat
  })
];

// Create the main logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: productionFormat,
  transports,
  exitOnError: false,
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      format: productionFormat
    })
  ],

  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      format: productionFormat
    })
  ]
});

// Create specialized loggers
const securityLogger = winston.createLogger({
  level: 'info',
  format: productionFormat,
  transports: [
    new winston.transports.Console({
      format: developmentFormat,
      level: 'warn'
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'security', 'security-%DATE%.log'),
      datePattern: config.logging.datePattern,
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      format: productionFormat
    })
  ]
});

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'audit', 'audit-%DATE%.log'),
      datePattern: config.logging.datePattern,
      maxSize: config.logging.maxSize,
      maxFiles: '2555d', // 7 years for compliance
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

const medicalLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'medical', 'medical-access-%DATE%.log'),
      datePattern: config.logging.datePattern,
      maxSize: config.logging.maxSize,
      maxFiles: '3650d', // 10 years for medical compliance
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

const performanceLogger = winston.createLogger({
  level: 'info',
  format: productionFormat,
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'performance', 'performance-%DATE%.log'),
      datePattern: config.logging.datePattern,
      maxSize: config.logging.maxSize,
      maxFiles: config.logging.maxFiles,
      format: productionFormat
    })
  ]
});

// Helper functions for structured logging
const logWithContext = (level, message, context = {}) => {
  const logEntry = {
    message,
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
    service: 'radiology-ai-gateway',
    ...context
  };

  logger[level](logEntry);
};

// Security logging helpers
const logSecurityEvent = (event, details = {}) => {
  const securityEvent = {
    event,
    timestamp: new Date().toISOString(),
    severity: details.severity || 'medium',
    source: details.source || 'api-gateway',
    ...details
  };

  securityLogger.warn('Security Event', securityEvent);
};

// Audit logging helpers
const logAuditEvent = (action, details = {}) => {
  const auditEvent = {
    action,
    timestamp: new Date().toISOString(),
    service: 'api-gateway',
    ...details
  };

  auditLogger.info(auditEvent);
};

// Medical data access logging
const logMedicalAccess = (action, details = {}) => {
  const medicalEvent = {
    action,
    timestamp: new Date().toISOString(),
    service: 'api-gateway',
    gdprCompliant: true,
    ...details
  };

  medicalLogger.info(medicalEvent);
};

// Performance logging
const logPerformance = (operation, duration, details = {}) => {
  const performanceEvent = {
    operation,
    duration,
    timestamp: new Date().toISOString(),
    service: 'api-gateway',
    ...details
  };

  performanceLogger.info(performanceEvent);
};

// Request logging helper
const logRequest = (req, res, responseTime) => {
  const requestLog = {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
    contentLength: res.get('Content-Length'),
    timestamp: new Date().toISOString()
  };

  if (res.statusCode >= 400) {
    logger.warn('HTTP Request Error', requestLog);
  } else {
    logger.info('HTTP Request', requestLog);
  }
};

// Error logging with stack trace
const logError = (error, context = {}) => {
  const errorLog = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    statusCode: error.statusCode,
    timestamp: new Date().toISOString(),
    ...context
  };

  logger.error('Application Error', errorLog);
};

// Add custom log levels for medical compliance
winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'cyan',
  debug: 'green',
  security: 'magenta',
  audit: 'blue',
  medical: 'white'
});

module.exports = {
  logger,
  securityLogger,
  auditLogger,
  medicalLogger,
  performanceLogger,
  logWithContext,
  logSecurityEvent,
  logAuditEvent,
  logMedicalAccess,
  logPerformance,
  logRequest,
  logError,
  
  // Convenience methods
  info: (message, meta) => logger.info(message, meta),
  warn: (message, meta) => logger.warn(message, meta),
  error: (message, meta) => logger.error(message, meta),
  debug: (message, meta) => logger.debug(message, meta)
};