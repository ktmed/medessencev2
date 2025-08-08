const { PrismaClient } = require('@prisma/client');
const config = require('../config/config');
const { logger } = require('../utils/logger');

let prisma = null;

/**
 * Initialize database connection
 */
const initializeDatabase = async () => {
  try {
    if (prisma) {
      logger.warn('Database connection already initialized');
      return prisma;
    }

    logger.info('Initializing database connection...');

    prisma = new PrismaClient({
      datasources: {
        db: {
          url: config.database.url
        }
      },
      log: [
        {
          emit: 'event',
          level: 'query',
        },
        {
          emit: 'event',
          level: 'error',
        },
        {
          emit: 'event',
          level: 'info',
        },
        {
          emit: 'event',
          level: 'warn',
        },
      ],
      errorFormat: 'pretty'
    });

    // Setup event listeners for logging
    prisma.$on('query', (e) => {
      if (config.nodeEnv === 'development') {
        logger.debug('Database Query', {
          query: e.query,
          params: e.params,
          duration: e.duration,
          timestamp: e.timestamp
        });
      }
    });

    prisma.$on('error', (e) => {
      logger.error('Database Error', {
        message: e.message,
        target: e.target,
        timestamp: e.timestamp
      });
    });

    prisma.$on('info', (e) => {
      logger.info('Database Info', {
        message: e.message,
        target: e.target,
        timestamp: e.timestamp
      });
    });

    prisma.$on('warn', (e) => {
      logger.warn('Database Warning', {
        message: e.message,
        target: e.target,
        timestamp: e.timestamp
      });
    });

    // Test connection
    await prisma.$connect();
    
    // Test query to ensure database is working
    await prisma.$queryRaw`SELECT 1 as test`;

    logger.info('Database connection established successfully', {
      database: config.database.database,
      host: config.database.host,
      port: config.database.port
    });

    return prisma;

  } catch (error) {
    logger.error('Failed to initialize database connection:', {
      error: error.message,
      stack: error.stack,
      code: error.code
    });
    
    // Cleanup on error
    if (prisma) {
      await prisma.$disconnect();
      prisma = null;
    }
    
    throw error;
  }
};

/**
 * Get database connection
 */
const getDatabase = () => {
  if (!prisma) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return prisma;
};

/**
 * Close database connection
 */
const closeDatabase = async () => {
  try {
    if (prisma) {
      logger.info('Closing database connection...');
      await prisma.$disconnect();
      prisma = null;
      logger.info('Database connection closed successfully');
    }
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
};

/**
 * Check database health
 */
const checkDatabaseHealth = async () => {
  try {
    if (!prisma) {
      return {
        status: 'disconnected',
        error: 'Database not initialized'
      };
    }

    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1 as health_check`;
    const responseTime = Date.now() - startTime;

    return {
      status: 'healthy',
      responseTime,
      connection: 'active'
    };

  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'unhealthy',
      error: error.message,
      connection: 'failed'
    };
  }
};

/**
 * Get database metrics
 */
const getDatabaseMetrics = async () => {
  try {
    if (!prisma) {
      return {
        connected: false,
        error: 'Database not initialized'
      };
    }

    const [
      userCount,
      activeSessionCount,
      auditLogCount,
      refreshTokenCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.session.count({
        where: {
          isActive: true,
          expiresAt: { gt: new Date() }
        }
      }),
      prisma.auditLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      }),
      prisma.refreshToken.count({
        where: {
          isRevoked: false,
          expiresAt: { gt: new Date() }
        }
      })
    ]);

    return {
      connected: true,
      metrics: {
        totalUsers: userCount,
        activeSessions: activeSessionCount,
        auditLogsLast24h: auditLogCount,
        activeRefreshTokens: refreshTokenCount
      }
    };

  } catch (error) {
    logger.error('Failed to get database metrics:', error);
    return {
      connected: false,
      error: error.message
    };
  }
};

/**
 * Database transaction wrapper
 */
const executeTransaction = async (callback) => {
  if (!prisma) {
    throw new Error('Database not initialized');
  }

  try {
    return await prisma.$transaction(callback);
  } catch (error) {
    logger.error('Database transaction failed:', error);
    throw error;
  }
};

/**
 * Cleanup expired data
 */
const cleanupExpiredData = async () => {
  try {
    if (!prisma) {
      throw new Error('Database not initialized');
    }

    logger.info('Starting expired data cleanup...');

    const now = new Date();
    const results = {};

    // Cleanup expired sessions
    const expiredSessions = await prisma.session.updateMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { lastActivity: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } // 30 days inactive
        ],
        isActive: true
      },
      data: {
        isActive: false,
        terminatedAt: now,
        terminationReason: 'expired'
      }
    });
    results.expiredSessions = expiredSessions.count;

    // Cleanup expired refresh tokens
    const expiredTokens = await prisma.refreshToken.updateMany({
      where: {
        expiresAt: { lt: now },
        isRevoked: false
      },
      data: {
        isRevoked: true,
        revokedAt: now
      }
    });
    results.expiredTokens = expiredTokens.count;

    // Cleanup old rate limit entries (older than 1 hour)
    const oldRateLimits = await prisma.rateLimitEntry.deleteMany({
      where: {
        windowEnd: { lt: new Date(Date.now() - 60 * 60 * 1000) }
      }
    });
    results.oldRateLimits = oldRateLimits.count;

    // Cleanup old audit logs (based on retention policy)
    if (config.audit.retentionDays > 0) {
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - config.audit.retentionDays);

      const oldAuditLogs = await prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: retentionDate },
          flagged: false,
          reviewRequired: false
        }
      });
      results.oldAuditLogs = oldAuditLogs.count;
    }

    logger.info('Expired data cleanup completed', results);
    return results;

  } catch (error) {
    logger.error('Failed to cleanup expired data:', error);
    throw error;
  }
};

/**
 * Setup database middleware for Express
 */
const databaseMiddleware = (req, res, next) => {
  req.db = getDatabase();
  next();
};

/**
 * Database connection monitoring
 */
const startDatabaseMonitoring = () => {
  // Check database health every 30 seconds
  setInterval(async () => {
    try {
      const health = await checkDatabaseHealth();
      if (health.status !== 'healthy') {
        logger.warn('Database health check failed', health);
      }
    } catch (error) {
      logger.error('Database monitoring error:', error);
    }
  }, 30000);

  // Cleanup expired data every hour
  setInterval(async () => {
    try {
      await cleanupExpiredData();
    } catch (error) {
      logger.error('Scheduled cleanup failed:', error);
    }
  }, 60 * 60 * 1000);

  logger.info('Database monitoring started');
};

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  checkDatabaseHealth,
  getDatabaseMetrics,
  executeTransaction,
  cleanupExpiredData,
  databaseMiddleware,
  startDatabaseMonitoring
};