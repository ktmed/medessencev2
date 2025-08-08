const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const CircuitBreaker = require('opossum');
const axios = require('axios');
const { authenticate, requirePermission } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { logMedicalAccess, logPerformance, logger } = require('../utils/logger');
const { 
  ServiceUnavailableError, 
  CircuitBreakerError, 
  TimeoutError,
  ExternalServiceError 
} = require('../utils/errors');
const config = require('../config/config');

const router = express.Router();

// Circuit breaker options
const circuitBreakerOptions = {
  timeout: config.circuitBreaker.timeout,
  errorThresholdPercentage: config.circuitBreaker.errorThresholdPercentage,
  resetTimeout: config.circuitBreaker.resetTimeout,
  rollingCountTimeout: config.circuitBreaker.rollingCountTimeout,
  rollingCountBuckets: config.circuitBreaker.rollingCountBuckets,
  name: 'ServiceProxy'
};

// Create circuit breakers for each service
const transcriptionBreaker = new CircuitBreaker(
  (options) => axios(options),
  { ...circuitBreakerOptions, name: 'TranscriptionService' }
);

const reportBreaker = new CircuitBreaker(
  (options) => axios(options),
  { ...circuitBreakerOptions, name: 'ReportService' }
);

const summaryBreaker = new CircuitBreaker(
  (options) => axios(options),
  { ...circuitBreakerOptions, name: 'SummaryService' }
);

// Circuit breaker event listeners
const setupCircuitBreakerEvents = (breaker, serviceName) => {
  breaker.on('open', () => {
    logger.warn(`Circuit breaker opened for ${serviceName}`);
  });

  breaker.on('halfOpen', () => {
    logger.info(`Circuit breaker half-open for ${serviceName}`);
  });

  breaker.on('close', () => {
    logger.info(`Circuit breaker closed for ${serviceName}`);
  });

  breaker.on('failure', (error) => {
    logger.error(`Circuit breaker failure for ${serviceName}:`, error);
  });
};

setupCircuitBreakerEvents(transcriptionBreaker, 'Transcription');
setupCircuitBreakerEvents(reportBreaker, 'Report');
setupCircuitBreakerEvents(summaryBreaker, 'Summary');

/**
 * Create enhanced proxy middleware with circuit breaker and logging
 */
const createEnhancedProxy = (target, serviceName, permissions = []) => {
  const breaker = serviceName === 'transcription' ? transcriptionBreaker :
                  serviceName === 'report' ? reportBreaker : summaryBreaker;

  return async (req, res, next) => {
    const startTime = Date.now();
    
    try {
      // Authentication check
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Please authenticate to access this service'
        });
      }

      // Permission check
      if (permissions.length > 0) {
        const hasPermission = permissions.some(permission =>
          req.user.permissions.some(p => p.permission === permission)
        );

        if (!hasPermission) {
          await createAuditLog({
            userId: req.user.id,
            action: 'UNAUTHORIZED_ACCESS',
            resource: serviceName,
            description: `Access denied to ${serviceName} service`,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            riskLevel: 'HIGH'
          });

          return res.status(403).json({
            error: 'Access denied',
            message: 'Insufficient permissions for this service'
          });
        }
      }

      // Prepare request options
      const requestOptions = {
        method: req.method,
        url: `${target}${req.path}`,
        headers: {
          ...req.headers,
          'x-user-id': req.user.id,
          'x-user-role': req.user.role,
          'x-user-department': req.user.department,
          'x-forwarded-for': req.ip,
          'x-request-id': req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        },
        timeout: config.services[serviceName]?.timeout || 30000,
        validateStatus: () => true // Don't throw on HTTP error codes
      };

      // Add request body for POST/PUT/PATCH
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        requestOptions.data = req.body;
      }

      // Add query parameters
      if (Object.keys(req.query).length > 0) {
        requestOptions.params = req.query;
      }

      // Make request through circuit breaker
      const response = await breaker.fire(requestOptions);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Log performance metrics
      logPerformance(`${serviceName}_proxy`, duration, {
        method: req.method,
        path: req.path,
        statusCode: response.status,
        userId: req.user.id,
        responseSize: response.headers['content-length']
      });

      // Log medical data access
      if (serviceName !== 'health' && serviceName !== 'metrics') {
        logMedicalAccess(`${serviceName.toUpperCase()}_ACCESSED`, {
          userId: req.user.id,
          service: serviceName,
          endpoint: req.path,
          method: req.method,
          statusCode: response.status,
          duration,
          patientId: response.data?.patientId || req.body?.patientId,
          dataType: serviceName
        });

        // Create audit log for medical data access
        await createAuditLog({
          userId: req.user.id,
          action: `${serviceName.toUpperCase()}_ACCESSED`,
          resource: serviceName,
          description: `Accessed ${serviceName} service: ${req.method} ${req.path}`,
          method: req.method,
          endpoint: req.path,
          responseStatus: response.status,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          medicalDataType: serviceName,
          gdprLawfulBasis: 'legitimate_interest'
        });
      }

      // Set response headers
      res.status(response.status);
      
      // Forward response headers (excluding hop-by-hop headers)
      const hopByHopHeaders = [
        'connection', 'keep-alive', 'proxy-authenticate',
        'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade'
      ];
      
      Object.entries(response.headers).forEach(([key, value]) => {
        if (!hopByHopHeaders.includes(key.toLowerCase())) {
          res.set(key, value);
        }
      });

      // Add custom headers
      res.set('x-service', serviceName);
      res.set('x-response-time', `${duration}ms`);
      res.set('x-circuit-breaker-state', breaker.state);

      // Send response
      res.json(response.data);

    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;

      logger.error(`Service proxy error for ${serviceName}:`, {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id,
        method: req.method,
        path: req.path,
        duration
      });

      // Create audit log for service errors
      await createAuditLog({
        userId: req.user?.id,
        action: 'SERVICE_ERROR',
        resource: serviceName,
        description: `Service error: ${error.message}`,
        method: req.method,
        endpoint: req.path,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        riskLevel: 'MEDIUM'
      });

      // Handle different error types
      if (error.code === 'EOPENBREAKER') {
        return res.status(503).json({
          error: 'Service unavailable',
          message: `${serviceName} service is temporarily unavailable`,
          code: 'CIRCUIT_BREAKER_OPEN'
        });
      }

      if (error.code === 'TIMEOUT' || error.code === 'ETIMEDOUT') {
        return res.status(504).json({
          error: 'Gateway timeout',
          message: `${serviceName} service request timed out`,
          code: 'SERVICE_TIMEOUT'
        });
      }

      if (error.response) {
        // Service responded with error
        return res.status(error.response.status).json({
          error: 'Service error',
          message: error.response.data?.message || `${serviceName} service error`,
          details: error.response.data,
          code: 'SERVICE_ERROR'
        });
      }

      // Network or other errors
      res.status(502).json({
        error: 'Bad gateway',
        message: `Unable to connect to ${serviceName} service`,
        code: 'SERVICE_UNAVAILABLE'
      });
    }
  };
};

/**
 * Transcription service proxy
 */
const transcriptionProxy = express.Router();
transcriptionProxy.use(authenticate);
transcriptionProxy.use(createEnhancedProxy(
  config.services.transcription.url,
  'transcription',
  ['TRANSCRIPTION_READ', 'TRANSCRIPTION_CREATE', 'TRANSCRIPTION_EDIT']
));

/**
 * Report generation service proxy
 */
const reportProxy = express.Router();
reportProxy.use(authenticate);
reportProxy.use(createEnhancedProxy(
  config.services.reports.url,
  'report',
  ['REPORT_READ', 'REPORT_CREATE', 'REPORT_EDIT']
));

/**
 * Summary generation service proxy
 */
const summaryProxy = express.Router();
summaryProxy.use(authenticate);
summaryProxy.use(createEnhancedProxy(
  config.services.summaries.url,
  'summary',
  ['SUMMARY_READ', 'SUMMARY_CREATE', 'SUMMARY_EDIT']
));

/**
 * Health check endpoint for services
 */
router.get('/health', authenticate, async (req, res) => {
  const services = [
    { name: 'transcription', url: config.services.transcription.url, breaker: transcriptionBreaker },
    { name: 'reports', url: config.services.reports.url, breaker: reportBreaker },
    { name: 'summaries', url: config.services.summaries.url, breaker: summaryBreaker }
  ];

  const healthChecks = await Promise.allSettled(
    services.map(async (service) => {
      try {
        const startTime = Date.now();
        const response = await axios.get(`${service.url}/health`, {
          timeout: 5000,
          headers: {
            'x-user-id': req.user.id,
            'x-health-check': 'true'
          }
        });
        const responseTime = Date.now() - startTime;

        return {
          name: service.name,
          status: 'healthy',
          responseTime,
          circuitBreakerState: service.breaker.state,
          version: response.data?.version,
          uptime: response.data?.uptime
        };
      } catch (error) {
        return {
          name: service.name,
          status: 'unhealthy',
          error: error.message,
          circuitBreakerState: service.breaker.state
        };
      }
    })
  );

  const results = healthChecks.map((check, index) => {
    if (check.status === 'fulfilled') {
      return check.value;
    } else {
      return {
        name: services[index].name,
        status: 'error',
        error: check.reason?.message || 'Unknown error',
        circuitBreakerState: services[index].breaker.state
      };
    }
  });

  const overallStatus = results.every(r => r.status === 'healthy') ? 'healthy' : 'degraded';

  res.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    services: results
  });
});

/**
 * Service metrics endpoint
 */
router.get('/metrics', authenticate, requirePermission('METRICS_READ'), async (req, res) => {
  const metrics = {
    transcription: {
      circuitBreaker: {
        state: transcriptionBreaker.state,
        stats: transcriptionBreaker.stats
      }
    },
    reports: {
      circuitBreaker: {
        state: reportBreaker.state,
        stats: reportBreaker.stats
      }
    },
    summaries: {
      circuitBreaker: {
        state: summaryBreaker.state,
        stats: summaryBreaker.stats
      }
    }
  };

  res.json({
    timestamp: new Date().toISOString(),
    metrics
  });
});

module.exports = {
  transcription: transcriptionProxy,
  reports: reportProxy,
  summaries: summaryProxy,
  health: router
};