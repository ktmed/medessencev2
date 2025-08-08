const rateLimit = require('express-rate-limit');
const { body, header, validationResult } = require('express-validator');
const { logSecurityEvent, logger } = require('../utils/logger');
const { createAuditLog } = require('../utils/audit');
const config = require('../config/config');

/**
 * Security middleware for input validation and sanitization
 */
const securityMiddleware = async (req, res, next) => {
  try {
    // Check for suspicious patterns in URL
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /%3Cscript/i,
      /\.\./,
      /\/\.\./,
      /%2e%2e/i,
      /union.*select/i,
      /select.*from/i,
      /'.*or.*'/i,
      /exec\s*\(/i,
      /drop\s+table/i
    ];

    const url = decodeURIComponent(req.url);
    const hasSuspiciousPattern = suspiciousPatterns.some(pattern => pattern.test(url));

    if (hasSuspiciousPattern) {
      logSecurityEvent('SUSPICIOUS_REQUEST', {
        pattern: 'URL_INJECTION_ATTEMPT',
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        severity: 'high'
      });

      await createAuditLog({
        userId: req.user?.id,
        action: 'SUSPICIOUS_ACTIVITY',
        resource: 'security',
        description: `Suspicious URL pattern detected: ${req.url}`,
        method: req.method,
        endpoint: req.path,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        riskLevel: 'HIGH',
        flagged: true
      });

      return res.status(400).json({
        error: 'Bad Request',
        message: 'Invalid request format',
        code: 'INVALID_REQUEST'
      });
    }

    // Check User-Agent header
    const userAgent = req.get('User-Agent');
    if (!userAgent || userAgent.length > 1000) {
      logSecurityEvent('SUSPICIOUS_USER_AGENT', {
        userAgent: userAgent || 'MISSING',
        ip: req.ip,
        severity: 'medium'
      });
    }

    // Check for known malicious User-Agents
    const maliciousUserAgents = [
      /sqlmap/i,
      /nmap/i,
      /nikto/i,
      /masscan/i,
      /zap/i,
      /burp/i,
      /scanner/i
    ];

    if (userAgent && maliciousUserAgents.some(pattern => pattern.test(userAgent))) {
      logSecurityEvent('MALICIOUS_USER_AGENT', {
        userAgent,
        ip: req.ip,
        severity: 'high'
      });

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }

    // Validate Content-Type for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.get('Content-Type');
      const allowedContentTypes = [
        'application/json',
        'application/x-www-form-urlencoded',
        'multipart/form-data',
        'text/plain'
      ];

      if (contentType && !allowedContentTypes.some(type => contentType.includes(type))) {
        return res.status(415).json({
          error: 'Unsupported Media Type',
          message: 'Content-Type not supported',
          code: 'UNSUPPORTED_CONTENT_TYPE'
        });
      }
    }

    // Check Content-Length
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);
    const maxContentLength = 50 * 1024 * 1024; // 50MB

    if (contentLength > maxContentLength) {
      return res.status(413).json({
        error: 'Payload Too Large',
        message: 'Request payload exceeds maximum size',
        code: 'PAYLOAD_TOO_LARGE'
      });
    }

    // Check for suspicious headers
    const suspiciousHeaders = [
      'x-forwarded-host',
      'x-originating-ip',
      'x-remote-ip',
      'x-remote-addr'
    ];

    suspiciousHeaders.forEach(header => {
      if (req.get(header)) {
        logSecurityEvent('SUSPICIOUS_HEADER', {
          header,
          value: req.get(header),
          ip: req.ip,
          severity: 'medium'
        });
      }
    });

    next();

  } catch (error) {
    logger.error('Security middleware error:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Security check failed'
    });
  }
};

/**
 * Input sanitization middleware
 */
const sanitizeInput = (req, res, next) => {
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    // Remove null bytes
    str = str.replace(/\0/g, '');
    
    // Trim whitespace
    str = str.trim();
    
    // Limit length
    if (str.length > 10000) {
      str = str.substring(0, 10000);
    }
    
    return str;
  };

  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sanitized = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  // Sanitize route parameters
  if (req.params) {
    req.params = sanitizeObject(req.params);
  }

  next();
};

/**
 * API key rate limiting
 */
const apiKeyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Higher limit for API keys
  keyGenerator: (req) => {
    return req.headers['x-api-key'] || req.ip;
  },
  message: {
    error: 'API rate limit exceeded',
    message: 'Too many API requests'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Strict rate limiting for sensitive endpoints
 */
const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Very low limit
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many requests to sensitive endpoint'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent('STRICT_RATE_LIMIT_EXCEEDED', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      severity: 'high'
    });
    
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: 'Too many requests to sensitive endpoint',
      retryAfter: 900
    });
  }
});

/**
 * CSRF protection middleware
 */
const csrfProtection = (req, res, next) => {
  // Skip CSRF for API requests with API keys
  if (req.headers['x-api-key']) {
    return next();
  }

  // Skip for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Check for CSRF token
  const token = req.headers['x-csrf-token'] || req.body._csrf;
  
  if (!token) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'CSRF token is required for this request',
      code: 'CSRF_TOKEN_MISSING'
    });
  }

  // In a real implementation, validate the CSRF token
  // For now, just check that it exists and has reasonable format
  if (typeof token !== 'string' || token.length < 16) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token is invalid',
      code: 'CSRF_TOKEN_INVALID'
    });
  }

  next();
};

/**
 * Brute force protection for login attempts
 */
const loginBruteForceProtection = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    // Rate limit by IP and email combination
    return `${req.ip}_${req.body?.email || 'unknown'}`;
  },
  message: {
    error: 'Too many login attempts',
    message: 'Account temporarily locked due to too many failed login attempts'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent('BRUTE_FORCE_ATTEMPT', {
      ip: req.ip,
      email: req.body?.email,
      userAgent: req.get('User-Agent'),
      severity: 'high'
    });
    
    res.status(429).json({
      error: 'Too many login attempts',
      message: 'Account temporarily locked. Try again in 15 minutes.',
      retryAfter: 900
    });
  }
});

/**
 * Request size limiting middleware
 */
const requestSizeLimit = (maxSize = 10 * 1024 * 1024) => { // 10MB default
  return (req, res, next) => {
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);
    
    if (contentLength > maxSize) {
      return res.status(413).json({
        error: 'Payload too large',
        message: `Request size exceeds ${maxSize} bytes`,
        code: 'PAYLOAD_TOO_LARGE'
      });
    }
    
    next();
  };
};

/**
 * IP whitelist middleware
 */
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    if (allowedIPs.length === 0) {
      return next(); // No whitelist configured
    }
    
    const clientIP = req.ip;
    
    if (!allowedIPs.includes(clientIP)) {
      logSecurityEvent('IP_BLOCKED', {
        ip: clientIP,
        allowedIPs,
        severity: 'medium'
      });
      
      return res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address is not allowed',
        code: 'IP_NOT_ALLOWED'
      });
    }
    
    next();
  };
};

/**
 * Security headers middleware
 */
const securityHeaders = (req, res, next) => {
  // Set security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  next();
};

module.exports = {
  securityMiddleware,
  sanitizeInput,
  apiKeyRateLimit,
  strictRateLimit,
  csrfProtection,
  loginBruteForceProtection,
  requestSizeLimit,
  ipWhitelist,
  securityHeaders
};