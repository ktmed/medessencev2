const promClient = require('prom-client');
const config = require('../config/config');
const { logger } = require('../utils/logger');

// Create a Registry
const register = new promClient.Registry();

// Add default metrics
if (config.metrics.collectDefaultMetrics) {
  promClient.collectDefaultMetrics({
    register,
    prefix: config.metrics.prefix
  });
}

// Custom metrics
const httpRequestsTotal = new promClient.Counter({
  name: `${config.metrics.prefix}http_requests_total`,
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'user_role'],
  registers: [register]
});

const httpRequestDuration = new promClient.Histogram({
  name: `${config.metrics.prefix}http_request_duration_seconds`,
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code', 'user_role'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register]
});

const authenticationAttempts = new promClient.Counter({
  name: `${config.metrics.prefix}authentication_attempts_total`,
  help: 'Total number of authentication attempts',
  labelNames: ['type', 'status', 'user_role'],
  registers: [register]
});

const activeUsers = new promClient.Gauge({
  name: `${config.metrics.prefix}active_users`,
  help: 'Number of currently active users',
  registers: [register]
});

const activeSessions = new promClient.Gauge({
  name: `${config.metrics.prefix}active_sessions`,
  help: 'Number of currently active sessions',
  registers: [register]
});

const serviceRequests = new promClient.Counter({
  name: `${config.metrics.prefix}service_requests_total`,
  help: 'Total number of requests to microservices',
  labelNames: ['service', 'method', 'status_code'],
  registers: [register]
});

const serviceRequestDuration = new promClient.Histogram({
  name: `${config.metrics.prefix}service_request_duration_seconds`,
  help: 'Service request duration in seconds',
  labelNames: ['service', 'method', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register]
});

const circuitBreakerState = new promClient.Gauge({
  name: `${config.metrics.prefix}circuit_breaker_state`,
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['service'],
  registers: [register]
});

const databaseConnections = new promClient.Gauge({
  name: `${config.metrics.prefix}database_connections`,
  help: 'Number of active database connections',
  registers: [register]
});

const redisConnections = new promClient.Gauge({
  name: `${config.metrics.prefix}redis_connections`,
  help: 'Number of active Redis connections',
  registers: [register]
});

const auditLogsCreated = new promClient.Counter({
  name: `${config.metrics.prefix}audit_logs_created_total`,
  help: 'Total number of audit logs created',
  labelNames: ['action', 'resource', 'risk_level'],
  registers: [register]
});

const medicalDataAccess = new promClient.Counter({
  name: `${config.metrics.prefix}medical_data_access_total`,
  help: 'Total number of medical data access events',
  labelNames: ['data_type', 'user_role', 'department'],
  registers: [register]
});

const errorRate = new promClient.Counter({
  name: `${config.metrics.prefix}errors_total`,
  help: 'Total number of errors',
  labelNames: ['error_type', 'error_code', 'route'],
  registers: [register]
});

const rateLimitHits = new promClient.Counter({
  name: `${config.metrics.prefix}rate_limit_hits_total`,
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint', 'user_id'],
  registers: [register]
});

/**
 * Metrics middleware for HTTP requests
 */
const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Increment request counter
  const route = req.route?.path || req.path;
  const userRole = req.user?.role || 'anonymous';
  
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    const statusCode = res.statusCode.toString();
    
    // Record metrics
    httpRequestsTotal
      .labels(req.method, route, statusCode, userRole)
      .inc();
    
    httpRequestDuration
      .labels(req.method, route, statusCode, userRole)
      .observe(duration);
    
    // Record errors
    if (res.statusCode >= 400) {
      errorRate
        .labels('http_error', statusCode, route)
        .inc();
    }
  });
  
  next();
};

/**
 * Record authentication metrics
 */
const recordAuthMetrics = (type, status, userRole = 'unknown') => {
  authenticationAttempts
    .labels(type, status, userRole)
    .inc();
};

/**
 * Record service request metrics
 */
const recordServiceMetrics = (service, method, statusCode, duration) => {
  serviceRequests
    .labels(service, method, statusCode.toString())
    .inc();
  
  serviceRequestDuration
    .labels(service, method, statusCode.toString())
    .observe(duration / 1000);
};

/**
 * Record circuit breaker state
 */
const recordCircuitBreakerState = (service, state) => {
  const stateValue = state === 'closed' ? 0 : state === 'open' ? 1 : 2;
  circuitBreakerState
    .labels(service)
    .set(stateValue);
};

/**
 * Record audit log metrics
 */
const recordAuditMetrics = (action, resource, riskLevel) => {
  auditLogsCreated
    .labels(action, resource, riskLevel)
    .inc();
};

/**
 * Record medical data access metrics
 */
const recordMedicalDataAccess = (dataType, userRole, department) => {
  medicalDataAccess
    .labels(dataType, userRole || 'unknown', department || 'unknown')
    .inc();
};

/**
 * Record rate limit hits
 */
const recordRateLimitHit = (endpoint, userId = 'anonymous') => {
  rateLimitHits
    .labels(endpoint, userId)
    .inc();
};

/**
 * Update system metrics
 */
const updateSystemMetrics = async () => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Update active users count
    const activeUserCount = await prisma.user.count({
      where: {
        isActive: true,
        lastLogin: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });
    activeUsers.set(activeUserCount);
    
    // Update active sessions count
    const activeSessionCount = await prisma.session.count({
      where: {
        isActive: true,
        expiresAt: {
          gt: new Date()
        }
      }
    });
    activeSessions.set(activeSessionCount);
    
  } catch (error) {
    logger.error('Failed to update system metrics:', error);
  }
};

/**
 * Start metrics collection
 */
const startMetricsCollection = () => {
  if (!config.metrics.enabled) {
    return;
  }
  
  // Update system metrics every 30 seconds
  setInterval(updateSystemMetrics, 30000);
  
  // Initial update
  updateSystemMetrics();
  
  logger.info('Metrics collection started', {
    enabled: config.metrics.enabled,
    prefix: config.metrics.prefix,
    port: config.metrics.port
  });
};

/**
 * Get metrics endpoint handler
 */
const getMetrics = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (error) {
    logger.error('Failed to get metrics:', error);
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error.message
    });
  }
};

/**
 * Get metrics summary
 */
const getMetricsSummary = async (req, res) => {
  try {
    const metrics = await register.getMetricsAsJSON();
    
    const summary = {
      timestamp: new Date().toISOString(),
      totalMetrics: metrics.length,
      categories: {
        http: metrics.filter(m => m.name.includes('http')).length,
        auth: metrics.filter(m => m.name.includes('auth')).length,
        service: metrics.filter(m => m.name.includes('service')).length,
        system: metrics.filter(m => m.name.includes('memory') || m.name.includes('cpu')).length,
        custom: metrics.filter(m => m.name.includes('audit') || m.name.includes('medical')).length
      },
      samples: metrics.reduce((total, metric) => {
        return total + (metric.values ? metric.values.length : 0);
      }, 0)
    };
    
    res.json(summary);
  } catch (error) {
    logger.error('Failed to get metrics summary:', error);
    res.status(500).json({
      error: 'Failed to get metrics summary',
      message: error.message
    });
  }
};

/**
 * Reset metrics (for testing purposes)
 */
const resetMetrics = (req, res) => {
  if (config.nodeEnv !== 'production') {
    register.clear();
    res.json({
      message: 'Metrics reset successfully',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(403).json({
      error: 'Metrics reset not allowed in production',
      message: 'This operation is only available in development mode'
    });
  }
};

module.exports = {
  register,
  metricsMiddleware,
  recordAuthMetrics,
  recordServiceMetrics,
  recordCircuitBreakerState,
  recordAuditMetrics,
  recordMedicalDataAccess,
  recordRateLimitHit,
  updateSystemMetrics,
  startMetricsCollection,
  getMetrics,
  getMetricsSummary,
  resetMetrics,
  
  // Export individual metrics for direct access
  httpRequestsTotal,
  httpRequestDuration,
  authenticationAttempts,
  activeUsers,
  activeSessions,
  serviceRequests,
  serviceRequestDuration,
  circuitBreakerState,
  databaseConnections,
  redisConnections,
  auditLogsCreated,
  medicalDataAccess,
  errorRate,
  rateLimitHits
};