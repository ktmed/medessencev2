/**
 * Custom application error classes for medical-grade error handling
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = null, isOperational = true) {
    super(message);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, field = null, value = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
    this.value = value;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', code = 'AUTH_FAILED') {
    super(message, 401, code);
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied', code = 'ACCESS_DENIED') {
    super(message, 403, code);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', resource = null) {
    super(message, 404, 'RESOURCE_NOT_FOUND');
    this.resource = resource;
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', resource = null) {
    super(message, 409, 'RESOURCE_CONFLICT');
    this.resource = resource;
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Rate limit exceeded', retryAfter = null) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable', service = null) {
    super(message, 503, 'SERVICE_UNAVAILABLE');
    this.service = service;
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', operation = null) {
    super(message, 500, 'DATABASE_ERROR');
    this.operation = operation;
  }
}

class ExternalServiceError extends AppError {
  constructor(message = 'External service error', service = null, originalError = null) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR');
    this.service = service;
    this.originalError = originalError;
  }
}

class GDPRComplianceError extends AppError {
  constructor(message = 'GDPR compliance violation', violation = null) {
    super(message, 451, 'GDPR_VIOLATION');
    this.violation = violation;
  }
}

class MedicalDataError extends AppError {
  constructor(message = 'Medical data handling error', dataType = null) {
    super(message, 422, 'MEDICAL_DATA_ERROR');
    this.dataType = dataType;
  }
}

class SecurityError extends AppError {
  constructor(message = 'Security violation detected', severity = 'medium') {
    super(message, 403, 'SECURITY_VIOLATION');
    this.severity = severity;
  }
}

class CircuitBreakerError extends AppError {
  constructor(message = 'Circuit breaker is open', service = null) {
    super(message, 503, 'CIRCUIT_BREAKER_OPEN');
    this.service = service;
  }
}

class TimeoutError extends AppError {
  constructor(message = 'Operation timed out', operation = null, timeout = null) {
    super(message, 408, 'OPERATION_TIMEOUT');
    this.operation = operation;
    this.timeout = timeout;
  }
}

class FileUploadError extends AppError {
  constructor(message = 'File upload failed', fileName = null, reason = null) {
    super(message, 400, 'FILE_UPLOAD_ERROR');
    this.fileName = fileName;
    this.reason = reason;
  }
}

class EncryptionError extends AppError {
  constructor(message = 'Encryption/Decryption failed', operation = null) {
    super(message, 500, 'ENCRYPTION_ERROR');
    this.operation = operation;
  }
}

/**
 * Error code mappings for standardized error responses
 */
const ERROR_CODES = {
  // Authentication errors
  AUTH_REQUIRED: 'Authentication is required',
  AUTH_FAILED: 'Authentication failed',
  TOKEN_INVALID: 'Invalid or expired token',
  TOKEN_EXPIRED: 'Token has expired',
  INVALID_CREDENTIALS: 'Invalid email or password',
  ACCOUNT_LOCKED: 'Account is temporarily locked',
  ACCOUNT_INACTIVE: 'Account is inactive',
  ACCOUNT_NOT_VERIFIED: 'Account is not verified',
  
  // Authorization errors
  ACCESS_DENIED: 'Access denied',
  INSUFFICIENT_PERMISSIONS: 'Insufficient permissions',
  PERMISSION_DENIED: 'Permission denied for this resource',
  ROLE_REQUIRED: 'Required role not found',
  
  // Validation errors
  VALIDATION_ERROR: 'Input validation failed',
  REQUIRED_FIELD: 'Required field is missing',
  INVALID_FORMAT: 'Invalid format',
  INVALID_EMAIL: 'Invalid email address',
  INVALID_PASSWORD: 'Password does not meet requirements',
  
  // Resource errors
  RESOURCE_NOT_FOUND: 'Requested resource not found',
  RESOURCE_CONFLICT: 'Resource already exists',
  RESOURCE_DELETED: 'Resource has been deleted',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'Too many requests',
  
  // Service errors
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  EXTERNAL_SERVICE_ERROR: 'External service error',
  DATABASE_ERROR: 'Database operation failed',
  CIRCUIT_BREAKER_OPEN: 'Service circuit breaker is open',
  
  // Medical and compliance errors
  GDPR_VIOLATION: 'GDPR compliance violation',
  MEDICAL_DATA_ERROR: 'Medical data handling error',
  AUDIT_REQUIRED: 'Audit trail required for this operation',
  CONSENT_REQUIRED: 'Patient consent required',
  
  // Security errors
  SECURITY_VIOLATION: 'Security violation detected',
  SUSPICIOUS_ACTIVITY: 'Suspicious activity detected',
  
  // File and data errors
  FILE_UPLOAD_ERROR: 'File upload failed',
  FILE_TOO_LARGE: 'File size exceeds limit',
  UNSUPPORTED_FILE_TYPE: 'Unsupported file type',
  ENCRYPTION_ERROR: 'Encryption/Decryption failed',
  
  // System errors
  OPERATION_TIMEOUT: 'Operation timed out',
  INTERNAL_ERROR: 'Internal server error',
  MAINTENANCE_MODE: 'System is under maintenance'
};

/**
 * HTTP status code mappings
 */
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  UNAVAILABLE_FOR_LEGAL_REASONS: 451, // GDPR compliance
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

/**
 * Get user-friendly error message
 */
const getUserFriendlyMessage = (error) => {
  const friendlyMessages = {
    VALIDATION_ERROR: 'Please check your input and try again.',
    AUTH_FAILED: 'Please check your credentials and try again.',
    ACCESS_DENIED: 'You do not have permission to perform this action.',
    RESOURCE_NOT_FOUND: 'The requested resource could not be found.',
    RATE_LIMIT_EXCEEDED: 'Too many requests. Please wait before trying again.',
    SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',
    INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
    GDPR_VIOLATION: 'This operation is not allowed due to privacy regulations.',
    MEDICAL_DATA_ERROR: 'Unable to process medical data. Please contact support.'
  };

  return friendlyMessages[error.code] || error.message || 'An unexpected error occurred.';
};

/**
 * Determine if error should be logged as security incident
 */
const isSecurityIncident = (error) => {
  const securityCodes = [
    'SECURITY_VIOLATION',
    'SUSPICIOUS_ACTIVITY',
    'UNAUTHORIZED_ACCESS',
    'BRUTE_FORCE_ATTEMPT',
    'INVALID_TOKEN',
    'PERMISSION_ESCALATION'
  ];

  return securityCodes.includes(error.code) || error instanceof SecurityError;
};

/**
 * Determine if error requires GDPR audit
 */
const requiresGDPRAudit = (error) => {
  const gdprCodes = [
    'GDPR_VIOLATION',
    'MEDICAL_DATA_ERROR',
    'UNAUTHORIZED_ACCESS',
    'DATA_BREACH',
    'CONSENT_VIOLATION'
  ];

  return gdprCodes.includes(error.code) || error instanceof GDPRComplianceError;
};

/**
 * Sanitize error for client response (remove sensitive information)
 */
const sanitizeError = (error) => {
  const sanitized = {
    error: error.name || 'Error',
    message: getUserFriendlyMessage(error),
    code: error.code,
    timestamp: error.timestamp || new Date().toISOString()
  };

  // Add specific fields for certain error types
  if (error instanceof ValidationError && error.field) {
    sanitized.field = error.field;
  }

  if (error instanceof RateLimitError && error.retryAfter) {
    sanitized.retryAfter = error.retryAfter;
  }

  // Don't expose internal details in production
  if (process.env.NODE_ENV !== 'production') {
    sanitized.stack = error.stack;
    sanitized.originalMessage = error.message;
  }

  return sanitized;
};

module.exports = {
  // Error classes
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ServiceUnavailableError,
  DatabaseError,
  ExternalServiceError,
  GDPRComplianceError,
  MedicalDataError,
  SecurityError,
  CircuitBreakerError,
  TimeoutError,
  FileUploadError,
  EncryptionError,

  // Constants
  ERROR_CODES,
  HTTP_STATUS,

  // Utility functions
  getUserFriendlyMessage,
  isSecurityIncident,
  requiresGDPRAudit,
  sanitizeError
};