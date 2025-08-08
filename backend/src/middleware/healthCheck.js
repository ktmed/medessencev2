const { PrismaClient } = require('@prisma/client');
const Redis = require('ioredis');
const config = require('../config/config');
const { logger } = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Health check middleware
 */
const healthCheck = async (req, res) => {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'radiology-ai-gateway',
    version: '1.0.0',
    uptime: process.uptime(),
    environment: config.nodeEnv,
    checks: {}
  };

  try {
    // Database health check
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      health.checks.database = {
        status: 'healthy',
        responseTime: Date.now() - dbStart,
        connection: 'active'
      };
    } catch (dbError) {
      health.checks.database = {
        status: 'unhealthy',
        error: dbError.message,
        connection: 'failed'
      };
      health.status = 'unhealthy';
    }

    // Redis health check
    try {
      const redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 1,
        lazyConnect: true
      });

      const redisStart = Date.now();
      await redis.ping();
      health.checks.redis = {
        status: 'healthy',
        responseTime: Date.now() - redisStart,
        connection: 'active'
      };
      redis.disconnect();
    } catch (redisError) {
      health.checks.redis = {
        status: 'unhealthy',
        error: redisError.message,
        connection: 'failed'
      };
      // Redis is not critical for basic functionality
      if (health.status === 'healthy') {
        health.status = 'degraded';
      }
    }

    // Memory usage check
    const memUsage = process.memoryUsage();
    health.checks.memory = {
      status: 'healthy',
      usage: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024) // MB
      }
    };

    // CPU usage estimation
    const cpuUsage = process.cpuUsage();
    health.checks.cpu = {
      status: 'healthy',
      usage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };

    // Service endpoints health (basic connectivity check)
    const serviceChecks = await Promise.allSettled([
      checkServiceHealth('transcription', config.services.transcription.url),
      checkServiceHealth('reports', config.services.reports.url),
      checkServiceHealth('summaries', config.services.summaries.url)
    ]);

    serviceChecks.forEach((check, index) => {
      const serviceName = ['transcription', 'reports', 'summaries'][index];
      if (check.status === 'fulfilled') {
        health.checks[serviceName] = check.value;
      } else {
        health.checks[serviceName] = {
          status: 'unhealthy',
          error: check.reason?.message || 'Unknown error'
        };
        if (health.status === 'healthy') {
          health.status = 'degraded';
        }
      }
    });

    // Response time
    health.responseTime = Date.now() - startTime;

    // Determine HTTP status code
    let statusCode = 200;
    if (health.status === 'unhealthy') {
      statusCode = 503; // Service Unavailable
    } else if (health.status === 'degraded') {
      statusCode = 200; // OK but with warnings
    }

    res.status(statusCode).json(health);

  } catch (error) {
    logger.error('Health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'radiology-ai-gateway',
      error: error.message,
      responseTime: Date.now() - startTime
    });
  }
};

/**
 * Check individual service health
 */
const checkServiceHealth = async (serviceName, serviceUrl) => {
  const axios = require('axios');
  
  try {
    const startTime = Date.now();
    const response = await axios.get(`${serviceUrl}/health`, {
      timeout: 5000,
      headers: {
        'User-Agent': 'RadiologyAI-Gateway-HealthCheck/1.0'
      }
    });
    
    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      version: response.data?.version,
      uptime: response.data?.uptime
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      code: error.code
    };
  }
};

/**
 * Detailed health check for monitoring systems
 */
const detailedHealthCheck = async (req, res) => {
  const startTime = Date.now();
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'radiology-ai-gateway',
    version: '1.0.0',
    uptime: process.uptime(),
    environment: config.nodeEnv,
    pid: process.pid,
    nodeVersion: process.version,
    checks: {},
    metrics: {}
  };

  try {
    // Detailed database metrics
    try {
      const dbStart = Date.now();
      
      // Test query
      await prisma.$queryRaw`SELECT 1`;
      
      // Connection pool info (if available)
      const dbMetrics = {
        responseTime: Date.now() - dbStart,
        connection: 'active'
      };

      // Get some basic database stats
      try {
        const userCount = await prisma.user.count();
        const sessionCount = await prisma.session.count({
          where: { isActive: true }
        });
        
        dbMetrics.stats = {
          totalUsers: userCount,
          activeSessions: sessionCount
        };
      } catch (statsError) {
        dbMetrics.statsError = statsError.message;
      }

      health.checks.database = {
        status: 'healthy',
        ...dbMetrics
      };
    } catch (dbError) {
      health.checks.database = {
        status: 'unhealthy',
        error: dbError.message
      };
      health.status = 'unhealthy';
    }

    // Detailed Redis metrics
    try {
      const redis = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 1,
        lazyConnect: true
      });

      const redisStart = Date.now();
      const info = await redis.info();
      const responseTime = Date.now() - redisStart;
      
      // Parse Redis info
      const redisInfo = {};
      info.split('\r\n').forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          redisInfo[key] = value;
        }
      });

      health.checks.redis = {
        status: 'healthy',
        responseTime,
        version: redisInfo.redis_version,
        connectedClients: redisInfo.connected_clients,
        usedMemory: redisInfo.used_memory_human,
        uptime: redisInfo.uptime_in_seconds
      };
      
      redis.disconnect();
    } catch (redisError) {
      health.checks.redis = {
        status: 'unhealthy',
        error: redisError.message
      };
      if (health.status === 'healthy') {
        health.status = 'degraded';
      }
    }

    // System metrics
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    health.metrics = {
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      eventLoop: {
        delay: process.hrtime.bigint ? Number(process.hrtime.bigint()) : 'unavailable'
      }
    };

    health.responseTime = Date.now() - startTime;

    // Determine status code
    let statusCode = 200;
    if (health.status === 'unhealthy') {
      statusCode = 503;
    } else if (health.status === 'degraded') {
      statusCode = 200;
    }

    res.status(statusCode).json(health);

  } catch (error) {
    logger.error('Detailed health check failed:', error);
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'radiology-ai-gateway',
      error: error.message,
      responseTime: Date.now() - startTime
    });
  }
};

/**
 * Simple liveness probe
 */
const livenessProbe = (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
};

/**
 * Readiness probe
 */
const readinessProbe = async (req, res) => {
  try {
    // Quick database connectivity check
    await prisma.$queryRaw`SELECT 1`;
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        database: 'connected'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
};

module.exports = {
  healthCheck,
  detailedHealthCheck,
  livenessProbe,
  readinessProbe,
  checkServiceHealth
};