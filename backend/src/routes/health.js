const express = require('express');
const { authenticate, requirePermission } = require('../middleware/auth');
const { 
  healthCheck, 
  detailedHealthCheck, 
  livenessProbe, 
  readinessProbe 
} = require('../middleware/healthCheck');
const { checkDatabaseHealth, getDatabaseMetrics } = require('../database/connection');
const { checkRedisHealth, getRedisMetrics } = require('../redis/connection');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *       503:
 *         description: Service is unhealthy
 */
router.get('/', healthCheck);

/**
 * @swagger
 * /api/v1/health/detailed:
 *   get:
 *     summary: Detailed health check with metrics
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Detailed health information
 *       503:
 *         description: Service is unhealthy
 */
router.get('/detailed', authenticate, requirePermission('HEALTH_CHECK'), detailedHealthCheck);

/**
 * @swagger
 * /api/v1/health/live:
 *   get:
 *     summary: Kubernetes liveness probe
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/live', livenessProbe);

/**
 * @swagger
 * /api/v1/health/ready:
 *   get:
 *     summary: Kubernetes readiness probe
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', readinessProbe);

/**
 * @swagger
 * /api/v1/health/database:
 *   get:
 *     summary: Database health check
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Database health information
 */
router.get('/database', authenticate, requirePermission('HEALTH_CHECK'), async (req, res) => {
  try {
    const health = await checkDatabaseHealth();
    const metrics = await getDatabaseMetrics();

    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      service: 'database',
      timestamp: new Date().toISOString(),
      health,
      metrics
    });

  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(503).json({
      service: 'database',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/health/redis:
 *   get:
 *     summary: Redis health check
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Redis health information
 */
router.get('/redis', authenticate, requirePermission('HEALTH_CHECK'), async (req, res) => {
  try {
    const health = await checkRedisHealth();
    const metrics = await getRedisMetrics();

    const statusCode = health.status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      service: 'redis',
      timestamp: new Date().toISOString(),
      health,
      metrics
    });

  } catch (error) {
    logger.error('Redis health check failed:', error);
    res.status(503).json({
      service: 'redis',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/health/services:
 *   get:
 *     summary: Microservices health check
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Services health information
 */
router.get('/services', authenticate, requirePermission('HEALTH_CHECK'), async (req, res) => {
  try {
    const axios = require('axios');
    const config = require('../config/config');

    const services = [
      { name: 'transcription', url: config.services.transcription.url },
      { name: 'reports', url: config.services.reports.url },
      { name: 'summaries', url: config.services.summaries.url }
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
            version: response.data?.version,
            uptime: response.data?.uptime,
            url: service.url
          };
        } catch (error) {
          return {
            name: service.name,
            status: 'unhealthy',
            error: error.message,
            code: error.code,
            url: service.url
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
          url: services[index].url
        };
      }
    });

    const overallStatus = results.every(r => r.status === 'healthy') ? 'healthy' : 'degraded';
    const statusCode = overallStatus === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      overallStatus,
      timestamp: new Date().toISOString(),
      services: results,
      summary: {
        total: results.length,
        healthy: results.filter(r => r.status === 'healthy').length,
        unhealthy: results.filter(r => r.status === 'unhealthy').length,
        error: results.filter(r => r.status === 'error').length
      }
    });

  } catch (error) {
    logger.error('Services health check failed:', error);
    res.status(503).json({
      overallStatus: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/health/system:
 *   get:
 *     summary: System resources health check
 *     tags: [Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health information
 */
router.get('/system', authenticate, requirePermission('HEALTH_CHECK'), async (req, res) => {
  try {
    const os = require('os');
    const process = require('process');

    // Memory usage
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // CPU usage
    const cpuUsage = process.cpuUsage();
    const loadAverage = os.loadavg();

    // Disk usage (simplified - in production you might want more detailed disk metrics)
    const diskUsage = {
      // This is a simplified check - implement proper disk usage monitoring
      available: 'unknown',
      used: 'unknown',
      total: 'unknown'
    };

    // System information
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      hostname: os.hostname(),
      release: os.release(),
      uptime: os.uptime(),
      nodeVersion: process.version,
      pid: process.pid
    };

    // Health assessment
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    const processMemoryMB = Math.round(memUsage.rss / 1024 / 1024);
    
    let status = 'healthy';
    const warnings = [];

    if (memoryUsagePercent > 90) {
      status = 'degraded';
      warnings.push('High system memory usage');
    }

    if (processMemoryMB > 1000) { // 1GB
      status = 'degraded';
      warnings.push('High process memory usage');
    }

    if (loadAverage[0] > os.cpus().length * 2) {
      status = 'degraded';
      warnings.push('High CPU load');
    }

    res.json({
      status,
      timestamp: new Date().toISOString(),
      warnings,
      system: {
        ...systemInfo,
        cpuCount: os.cpus().length
      },
      memory: {
        system: {
          total: Math.round(totalMemory / 1024 / 1024), // MB
          free: Math.round(freeMemory / 1024 / 1024), // MB
          used: Math.round(usedMemory / 1024 / 1024), // MB
          usagePercent: Math.round(memoryUsagePercent)
        },
        process: {
          rss: Math.round(memUsage.rss / 1024 / 1024), // MB
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
          external: Math.round(memUsage.external / 1024 / 1024) // MB
        }
      },
      cpu: {
        usage: cpuUsage,
        loadAverage: loadAverage.map(load => Math.round(load * 100) / 100)
      },
      disk: diskUsage
    });

  } catch (error) {
    logger.error('System health check failed:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

module.exports = router;