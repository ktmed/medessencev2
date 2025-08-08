const express = require('express');
const { authenticate, requirePermission } = require('../middleware/auth');
const { 
  getMetrics, 
  getMetricsSummary, 
  resetMetrics,
  register 
} = require('../middleware/metrics');
const { logger } = require('../utils/logger');

const router = express.Router();

/**
 * @swagger
 * /api/v1/metrics:
 *   get:
 *     summary: Get Prometheus metrics
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Prometheus metrics in text format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/', authenticate, requirePermission('METRICS_READ'), getMetrics);

/**
 * @swagger
 * /api/v1/metrics/summary:
 *   get:
 *     summary: Get metrics summary
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics summary information
 */
router.get('/summary', authenticate, requirePermission('METRICS_READ'), getMetricsSummary);

/**
 * @swagger
 * /api/v1/metrics/health:
 *   get:
 *     summary: Get metrics system health
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics system health
 */
router.get('/health', authenticate, requirePermission('METRICS_READ'), async (req, res) => {
  try {
    const metrics = await register.getMetricsAsJSON();
    
    // Analyze metrics for health indicators
    const httpMetrics = metrics.find(m => m.name.includes('http_requests_total'));
    const errorMetrics = metrics.find(m => m.name.includes('errors_total'));
    const memoryMetrics = metrics.find(m => m.name.includes('process_resident_memory_bytes'));
    
    let status = 'healthy';
    const indicators = [];

    // Check error rate
    if (errorMetrics && httpMetrics) {
      const totalRequests = httpMetrics.values?.reduce((sum, v) => sum + v.value, 0) || 0;
      const totalErrors = errorMetrics.values?.reduce((sum, v) => sum + v.value, 0) || 0;
      const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

      if (errorRate > 10) {
        status = 'degraded';
        indicators.push({
          type: 'error_rate',
          value: errorRate,
          threshold: 10,
          message: 'High error rate detected'
        });
      }
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const memoryUsageMB = Math.round(memUsage.rss / 1024 / 1024);
    
    if (memoryUsageMB > 1000) { // 1GB threshold
      status = 'degraded';
      indicators.push({
        type: 'memory_usage',
        value: memoryUsageMB,
        threshold: 1000,
        message: 'High memory usage detected'
      });
    }

    res.json({
      status,
      timestamp: new Date().toISOString(),
      indicators,
      metricsCount: metrics.length,
      samplesCount: metrics.reduce((total, metric) => {
        return total + (metric.values ? metric.values.length : 0);
      }, 0)
    });

  } catch (error) {
    logger.error('Metrics health check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/metrics/top:
 *   get:
 *     summary: Get top metrics by request count
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of top metrics to return
 *     responses:
 *       200:
 *         description: Top metrics by request count
 */
router.get('/top', authenticate, requirePermission('METRICS_READ'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const metrics = await register.getMetricsAsJSON();

    // Find HTTP request metrics
    const httpMetrics = metrics.find(m => m.name.includes('http_requests_total'));
    
    if (!httpMetrics || !httpMetrics.values) {
      return res.json({
        timestamp: new Date().toISOString(),
        topEndpoints: [],
        message: 'No HTTP metrics available'
      });
    }

    // Group by route and sum requests
    const routeStats = {};
    
    httpMetrics.values.forEach(value => {
      const route = value.labels?.route || 'unknown';
      const method = value.labels?.method || 'unknown';
      const statusCode = value.labels?.status_code || 'unknown';
      const key = `${method} ${route}`;

      if (!routeStats[key]) {
        routeStats[key] = {
          route,
          method,
          totalRequests: 0,
          statusCodes: {}
        };
      }

      routeStats[key].totalRequests += value.value;
      routeStats[key].statusCodes[statusCode] = 
        (routeStats[key].statusCodes[statusCode] || 0) + value.value;
    });

    // Sort by total requests and get top N
    const topEndpoints = Object.values(routeStats)
      .sort((a, b) => b.totalRequests - a.totalRequests)
      .slice(0, limit);

    res.json({
      timestamp: new Date().toISOString(),
      limit,
      topEndpoints
    });

  } catch (error) {
    logger.error('Top metrics retrieval failed:', error);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/metrics/users:
 *   get:
 *     summary: Get user activity metrics
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User activity metrics
 */
router.get('/users', authenticate, requirePermission('METRICS_READ'), async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers24h,
      activeUsers7d,
      activeUsers30d,
      activeSessions,
      usersByRole,
      usersByDepartment
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({
        where: {
          isActive: true,
          lastLogin: { gte: last24h }
        }
      }),
      prisma.user.count({
        where: {
          isActive: true,
          lastLogin: { gte: last7d }
        }
      }),
      prisma.user.count({
        where: {
          isActive: true,
          lastLogin: { gte: last30d }
        }
      }),
      prisma.session.count({
        where: {
          isActive: true,
          expiresAt: { gt: now }
        }
      }),
      prisma.user.groupBy({
        by: ['role'],
        where: { isActive: true },
        _count: { role: true }
      }),
      prisma.user.groupBy({
        by: ['department'],
        where: { 
          isActive: true,
          department: { not: null }
        },
        _count: { department: true }
      })
    ]);

    res.json({
      timestamp: new Date().toISOString(),
      users: {
        total: totalUsers,
        active: {
          last24h: activeUsers24h,
          last7d: activeUsers7d,
          last30d: activeUsers30d
        },
        activeSessions
      },
      distribution: {
        byRole: usersByRole.map(item => ({
          role: item.role,
          count: item._count.role
        })),
        byDepartment: usersByDepartment.map(item => ({
          department: item.department,
          count: item._count.department
        }))
      }
    });

  } catch (error) {
    logger.error('User metrics retrieval failed:', error);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/metrics/performance:
 *   get:
 *     summary: Get performance metrics
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance metrics
 */
router.get('/performance', authenticate, requirePermission('METRICS_READ'), async (req, res) => {
  try {
    const metrics = await register.getMetricsAsJSON();

    // Find performance-related metrics
    const durationMetrics = metrics.find(m => m.name.includes('http_request_duration_seconds'));
    const memoryMetrics = metrics.find(m => m.name.includes('process_resident_memory_bytes'));
    const cpuMetrics = metrics.find(m => m.name.includes('process_cpu_seconds_total'));

    // Calculate performance statistics
    let avgResponseTime = 0;
    let slowestEndpoints = [];

    if (durationMetrics && durationMetrics.values) {
      const routePerformance = {};

      durationMetrics.values.forEach(value => {
        if (value.labels?.le === '+Inf') { // This is the count
          const route = value.labels?.route || 'unknown';
          const method = value.labels?.method || 'unknown';
          const key = `${method} ${route}`;

          if (!routePerformance[key]) {
            routePerformance[key] = {
              route,
              method,
              count: 0,
              totalDuration: 0
            };
          }

          routePerformance[key].count += value.value;
        }
      });

      // Calculate average response times (simplified calculation)
      slowestEndpoints = Object.values(routePerformance)
        .filter(item => item.count > 0)
        .map(item => ({
          ...item,
          avgResponseTime: item.totalDuration / item.count // This is simplified
        }))
        .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
        .slice(0, 10);
    }

    // System performance
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    res.json({
      timestamp: new Date().toISOString(),
      performance: {
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024), // MB
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
          external: Math.round(memUsage.external / 1024 / 1024) // MB
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        },
        uptime: process.uptime()
      },
      endpoints: {
        slowestEndpoints
      }
    });

  } catch (error) {
    logger.error('Performance metrics retrieval failed:', error);
    res.status(500).json({
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/v1/metrics/reset:
 *   post:
 *     summary: Reset metrics (development only)
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Metrics reset successfully
 *       403:
 *         description: Not allowed in production
 */
router.post('/reset', authenticate, requirePermission('SYSTEM_ADMIN'), resetMetrics);

module.exports = router;