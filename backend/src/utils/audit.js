const { PrismaClient } = require('@prisma/client');
const { auditLogger, logAuditEvent } = require('./logger');
const config = require('../config/config');

const prisma = new PrismaClient();

/**
 * Create audit log entry for GDPR compliance
 */
const createAuditLog = async (auditData) => {
  try {
    const {
      userId,
      action,
      resource,
      resourceId,
      description,
      method,
      endpoint,
      requestBody,
      responseStatus,
      ipAddress,
      userAgent,
      sessionId,
      patientId,
      medicalDataType,
      gdprLawfulBasis,
      riskLevel = 'LOW',
      flagged = false,
      reviewRequired = false
    } = auditData;

    // Sanitize request body to remove sensitive information
    const sanitizedRequestBody = sanitizeRequestBody(requestBody);

    // Create audit log in database
    const audit = await prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        description,
        method,
        endpoint,
        requestBody: sanitizedRequestBody,
        responseStatus,
        ipAddress,
        userAgent,
        sessionId,
        patientId,
        medicalDataType,
        gdprLawfulBasis,
        riskLevel,
        flagged,
        reviewRequired
      }
    });

    // Also log to audit logger for external systems
    logAuditEvent(action, {
      auditId: audit.id,
      userId,
      resource,
      resourceId,
      ipAddress,
      riskLevel,
      gdprLawfulBasis
    });

    return audit;

  } catch (error) {
    // Fallback to file logging if database fails
    auditLogger.error('Failed to create audit log in database', {
      error: error.message,
      auditData: sanitizeRequestBody(auditData)
    });
    
    throw error;
  }
};

/**
 * Sanitize request body for audit logging
 */
const sanitizeRequestBody = (requestBody) => {
  if (!requestBody || typeof requestBody !== 'object') {
    return requestBody;
  }

  const sanitized = { ...requestBody };
  const sensitiveFields = config.audit.sensitiveFields || [
    'password', 'token', 'apiKey', 'personalData', 'ssn', 'dateOfBirth'
  ];

  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const result = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = sanitizeObject(value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  };

  return sanitizeObject(sanitized);
};

/**
 * Audit middleware for Express routes
 */
const auditMiddleware = (req, res, next) => {
  // Store original end method
  const originalEnd = res.end;
  
  // Override end method to capture response
  res.end = function(chunk, encoding) {
    // Restore original end method
    res.end = originalEnd;
    
    // Create audit log for completed request
    setImmediate(async () => {
      try {
        await createAuditLog({
          userId: req.user?.id,
          action: getAuditAction(req.method, req.path, res.statusCode),
          resource: getResourceType(req.path),
          resourceId: getResourceId(req.path, req.body),
          description: `${req.method} ${req.path} - ${res.statusCode}`,
          method: req.method,
          endpoint: req.path,
          requestBody: req.body,
          responseStatus: res.statusCode,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          sessionId: req.sessionID,
          riskLevel: getRiskLevel(req, res),
          flagged: shouldFlag(req, res),
          reviewRequired: requiresReview(req, res)
        });
      } catch (error) {
        auditLogger.error('Failed to create audit log:', error);
      }
    });
    
    // Call original end method
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

/**
 * Determine audit action based on request
 */
const getAuditAction = (method, path, statusCode) => {
  const pathLower = path.toLowerCase();
  
  // Authentication actions
  if (pathLower.includes('/auth/login')) {
    return statusCode === 200 ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED';
  }
  if (pathLower.includes('/auth/logout')) {
    return 'LOGOUT';
  }
  if (pathLower.includes('/auth/register')) {
    return 'USER_CREATED';
  }
  
  // Medical data actions
  if (pathLower.includes('/transcription')) {
    switch (method) {
      case 'GET': return 'TRANSCRIPTION_ACCESSED';
      case 'POST': return 'TRANSCRIPTION_CREATED';
      case 'PUT': case 'PATCH': return 'TRANSCRIPTION_UPDATED';
      case 'DELETE': return 'TRANSCRIPTION_DELETED';
    }
  }
  
  if (pathLower.includes('/reports')) {
    switch (method) {
      case 'GET': return 'REPORT_ACCESSED';
      case 'POST': return 'REPORT_CREATED';
      case 'PUT': case 'PATCH': return 'REPORT_UPDATED';
      case 'DELETE': return 'REPORT_DELETED';
    }
  }
  
  if (pathLower.includes('/summaries')) {
    switch (method) {
      case 'GET': return 'SUMMARY_ACCESSED';
      case 'POST': return 'SUMMARY_CREATED';
      case 'PUT': case 'PATCH': return 'SUMMARY_UPDATED';
      case 'DELETE': return 'SUMMARY_DELETED';
    }
  }
  
  // User management actions
  if (pathLower.includes('/users')) {
    switch (method) {
      case 'GET': return 'USER_ACCESSED';
      case 'POST': return 'USER_CREATED';
      case 'PUT': case 'PATCH': return 'USER_UPDATED';
      case 'DELETE': return 'USER_DELETED';
    }
  }
  
  // Security events
  if (statusCode === 401) return 'UNAUTHORIZED_ACCESS';
  if (statusCode === 403) return 'ACCESS_DENIED';
  if (statusCode === 429) return 'RATE_LIMIT_EXCEEDED';
  
  // Default action
  return 'API_ACCESS';
};

/**
 * Determine resource type based on path
 */
const getResourceType = (path) => {
  const pathLower = path.toLowerCase();
  
  if (pathLower.includes('/auth')) return 'authentication';
  if (pathLower.includes('/users')) return 'user';
  if (pathLower.includes('/transcription')) return 'transcription';
  if (pathLower.includes('/reports')) return 'report';
  if (pathLower.includes('/summaries')) return 'summary';
  if (pathLower.includes('/health')) return 'health';
  if (pathLower.includes('/metrics')) return 'metrics';
  
  return 'api';
};

/**
 * Extract resource ID from path or body
 */
const getResourceId = (path, body) => {
  // Extract ID from path (e.g., /api/v1/users/123)
  const idMatch = path.match(/\/([a-f\d-]{24,}|\d+)(?:\/|$)/i);
  if (idMatch) {
    return idMatch[1];
  }
  
  // Extract ID from body
  if (body && (body.id || body._id)) {
    return body.id || body._id;
  }
  
  return null;
};

/**
 * Determine risk level based on request/response
 */
const getRiskLevel = (req, res) => {
  const pathLower = req.path.toLowerCase();
  
  // High risk operations
  if (res.statusCode >= 500) return 'CRITICAL';
  if (res.statusCode === 401 || res.statusCode === 403) return 'HIGH';
  if (pathLower.includes('/admin') || pathLower.includes('/delete')) return 'HIGH';
  if (req.method === 'DELETE') return 'HIGH';
  
  // Medium risk operations
  if (pathLower.includes('/users') && req.method !== 'GET') return 'MEDIUM';
  if (pathLower.includes('/auth')) return 'MEDIUM';
  if (res.statusCode >= 400) return 'MEDIUM';
  
  // Low risk operations
  return 'LOW';
};

/**
 * Determine if request should be flagged for review
 */
const shouldFlag = (req, res) => {
  // Flag high-risk operations
  if (getRiskLevel(req, res) === 'CRITICAL') return true;
  
  // Flag multiple failed login attempts
  if (req.path.includes('/auth/login') && res.statusCode !== 200) {
    return true;
  }
  
  // Flag suspicious activity patterns
  if (res.statusCode === 401 || res.statusCode === 403) {
    return true;
  }
  
  return false;
};

/**
 * Determine if request requires manual review
 */
const requiresReview = (req, res) => {
  // Require review for critical security events
  if (res.statusCode === 401 && req.path.includes('/admin')) return true;
  if (res.statusCode >= 500) return true;
  if (req.method === 'DELETE' && req.path.includes('/users')) return true;
  
  return false;
};

/**
 * Get audit logs with filtering and pagination
 */
const getAuditLogs = async (filters = {}, pagination = {}) => {
  const {
    userId,
    action,
    resource,
    riskLevel,
    flagged,
    startDate,
    endDate
  } = filters;

  const {
    page = 1,
    limit = 50,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = pagination;

  const where = {};
  
  if (userId) where.userId = userId;
  if (action) where.action = action;
  if (resource) where.resource = resource;
  if (riskLevel) where.riskLevel = riskLevel;
  if (flagged !== undefined) where.flagged = flagged;
  
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.auditLog.count({ where })
  ]);

  return {
    logs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

/**
 * Clean up old audit logs based on retention policy
 */
const cleanupAuditLogs = async () => {
  try {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - config.audit.retentionDays);

    const deleted = await prisma.auditLog.deleteMany({
      where: {
        createdAt: {
          lt: retentionDate
        },
        flagged: false,
        reviewRequired: false
      }
    });

    auditLogger.info('Audit log cleanup completed', {
      deletedCount: deleted.count,
      retentionDate: retentionDate.toISOString()
    });

    return deleted.count;

  } catch (error) {
    auditLogger.error('Audit log cleanup failed:', error);
    throw error;
  }
};

/**
 * Export audit logs for compliance reporting
 */
const exportAuditLogs = async (filters = {}, format = 'json') => {
  try {
    const { logs } = await getAuditLogs(filters, { limit: 10000 });
    
    if (format === 'csv') {
      // Convert to CSV format
      const csvHeader = 'Timestamp,User ID,Action,Resource,Description,Risk Level,IP Address\n';
      const csvRows = logs.map(log => 
        `${log.createdAt.toISOString()},${log.userId || ''},${log.action},${log.resource},"${log.description}",${log.riskLevel},${log.ipAddress || ''}`
      ).join('\n');
      
      return csvHeader + csvRows;
    }
    
    return JSON.stringify(logs, null, 2);

  } catch (error) {
    auditLogger.error('Audit log export failed:', error);
    throw error;
  }
};

module.exports = {
  createAuditLog,
  auditMiddleware,
  getAuditLogs,
  cleanupAuditLogs,
  exportAuditLogs,
  sanitizeRequestBody
};