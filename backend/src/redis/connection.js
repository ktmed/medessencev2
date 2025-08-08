const Redis = require('ioredis');
const config = require('../config/config');
const { logger } = require('../utils/logger');

let redis = null;
let subscriber = null;
let publisher = null;

/**
 * Initialize Redis connection
 */
const initializeRedis = async () => {
  try {
    if (redis) {
      logger.warn('Redis connection already initialized');
      return redis;
    }

    logger.info('Initializing Redis connection...');

    const redisConfig = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryDelayOnFailover: config.redis.retryDelayOnFailover,
      enableReadyCheck: config.redis.enableReadyCheck,
      maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
      lazyConnect: config.redis.lazyConnect,
      keepAlive: config.redis.keepAlive,
      family: config.redis.family,
      connectTimeout: 10000,
      commandTimeout: 5000,
      retryDelayOnFailover: 100,
      enableOfflineQueue: false
    };

    // Main Redis connection
    redis = new Redis(redisConfig);

    // Publisher connection for pub/sub
    publisher = new Redis({
      ...redisConfig,
      lazyConnect: false
    });

    // Subscriber connection for pub/sub
    subscriber = new Redis({
      ...redisConfig,
      lazyConnect: false
    });

    // Setup event listeners
    setupRedisEventListeners(redis, 'main');
    setupRedisEventListeners(publisher, 'publisher');
    setupRedisEventListeners(subscriber, 'subscriber');

    // Connect and test
    await redis.connect();
    await publisher.connect();
    await subscriber.connect();

    // Test connection
    const pong = await redis.ping();
    if (pong !== 'PONG') {
      throw new Error('Redis ping test failed');
    }

    logger.info('Redis connection established successfully', {
      host: config.redis.host,
      port: config.redis.port,
      db: config.redis.db
    });

    return redis;

  } catch (error) {
    logger.error('Failed to initialize Redis connection:', {
      error: error.message,
      stack: error.stack,
      code: error.code
    });

    // Cleanup on error
    await closeRedis();
    
    throw error;
  }
};

/**
 * Setup Redis event listeners
 */
const setupRedisEventListeners = (client, type) => {
  client.on('connect', () => {
    logger.info(`Redis ${type} client connected`);
  });

  client.on('ready', () => {
    logger.info(`Redis ${type} client ready`);
  });

  client.on('error', (error) => {
    logger.error(`Redis ${type} client error:`, {
      error: error.message,
      code: error.code
    });
  });

  client.on('close', () => {
    logger.warn(`Redis ${type} client connection closed`);
  });

  client.on('reconnecting', (ms) => {
    logger.info(`Redis ${type} client reconnecting in ${ms}ms`);
  });

  client.on('end', () => {
    logger.warn(`Redis ${type} client connection ended`);
  });
};

/**
 * Get Redis connection
 */
const getRedis = () => {
  if (!redis) {
    throw new Error('Redis not initialized. Call initializeRedis() first.');
  }
  return redis;
};

/**
 * Get Redis publisher
 */
const getPublisher = () => {
  if (!publisher) {
    throw new Error('Redis publisher not initialized. Call initializeRedis() first.');
  }
  return publisher;
};

/**
 * Get Redis subscriber
 */
const getSubscriber = () => {
  if (!subscriber) {
    throw new Error('Redis subscriber not initialized. Call initializeRedis() first.');
  }
  return subscriber;
};

/**
 * Close Redis connections
 */
const closeRedis = async () => {
  try {
    logger.info('Closing Redis connections...');

    const promises = [];

    if (redis) {
      promises.push(redis.disconnect());
    }

    if (publisher) {
      promises.push(publisher.disconnect());
    }

    if (subscriber) {
      promises.push(subscriber.disconnect());
    }

    await Promise.all(promises);

    redis = null;
    publisher = null;
    subscriber = null;

    logger.info('Redis connections closed successfully');

  } catch (error) {
    logger.error('Error closing Redis connections:', error);
    throw error;
  }
};

/**
 * Check Redis health
 */
const checkRedisHealth = async () => {
  try {
    if (!redis) {
      return {
        status: 'disconnected',
        error: 'Redis not initialized'
      };
    }

    const startTime = Date.now();
    const pong = await redis.ping();
    const responseTime = Date.now() - startTime;

    if (pong !== 'PONG') {
      return {
        status: 'unhealthy',
        error: 'Redis ping test failed',
        response: pong
      };
    }

    return {
      status: 'healthy',
      responseTime,
      connection: 'active'
    };

  } catch (error) {
    logger.error('Redis health check failed:', error);
    return {
      status: 'unhealthy',
      error: error.message,
      connection: 'failed'
    };
  }
};

/**
 * Get Redis metrics
 */
const getRedisMetrics = async () => {
  try {
    if (!redis) {
      return {
        connected: false,
        error: 'Redis not initialized'
      };
    }

    const info = await redis.info();
    const redisInfo = {};
    
    // Parse Redis info
    info.split('\r\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        redisInfo[key] = value;
      }
    });

    return {
      connected: true,
      version: redisInfo.redis_version,
      mode: redisInfo.redis_mode,
      connectedClients: parseInt(redisInfo.connected_clients || '0', 10),
      usedMemory: redisInfo.used_memory_human,
      usedMemoryBytes: parseInt(redisInfo.used_memory || '0', 10),
      maxMemory: redisInfo.maxmemory_human || 'unlimited',
      uptime: parseInt(redisInfo.uptime_in_seconds || '0', 10),
      totalConnections: parseInt(redisInfo.total_connections_received || '0', 10),
      totalCommands: parseInt(redisInfo.total_commands_processed || '0', 10),
      keyspaceHits: parseInt(redisInfo.keyspace_hits || '0', 10),
      keyspaceMisses: parseInt(redisInfo.keyspace_misses || '0', 10)
    };

  } catch (error) {
    logger.error('Failed to get Redis metrics:', error);
    return {
      connected: false,
      error: error.message
    };
  }
};

/**
 * Session management helpers
 */
const sessionHelpers = {
  /**
   * Set session data
   */
  setSession: async (sessionId, data, ttl = 3600) => {
    try {
      const key = `session:${sessionId}`;
      await redis.setex(key, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      logger.error('Failed to set session:', error);
      return false;
    }
  },

  /**
   * Get session data
   */
  getSession: async (sessionId) => {
    try {
      const key = `session:${sessionId}`;
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Failed to get session:', error);
      return null;
    }
  },

  /**
   * Delete session
   */
  deleteSession: async (sessionId) => {
    try {
      const key = `session:${sessionId}`;
      await redis.del(key);
      return true;
    } catch (error) {
      logger.error('Failed to delete session:', error);
      return false;
    }
  },

  /**
   * Extend session TTL
   */
  extendSession: async (sessionId, ttl = 3600) => {
    try {
      const key = `session:${sessionId}`;
      await redis.expire(key, ttl);
      return true;
    } catch (error) {
      logger.error('Failed to extend session:', error);
      return false;
    }
  }
};

/**
 * Cache helpers
 */
const cacheHelpers = {
  /**
   * Set cache data
   */
  set: async (key, data, ttl = 3600) => {
    try {
      const cacheKey = `cache:${key}`;
      await redis.setex(cacheKey, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      logger.error('Failed to set cache:', error);
      return false;
    }
  },

  /**
   * Get cache data
   */
  get: async (key) => {
    try {
      const cacheKey = `cache:${key}`;
      const data = await redis.get(cacheKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Failed to get cache:', error);
      return null;
    }
  },

  /**
   * Delete cache data
   */
  delete: async (key) => {
    try {
      const cacheKey = `cache:${key}`;
      await redis.del(cacheKey);
      return true;
    } catch (error) {
      logger.error('Failed to delete cache:', error);
      return false;
    }
  },

  /**
   * Check if key exists
   */
  exists: async (key) => {
    try {
      const cacheKey = `cache:${key}`;
      const exists = await redis.exists(cacheKey);
      return exists === 1;
    } catch (error) {
      logger.error('Failed to check cache existence:', error);
      return false;
    }
  }
};

/**
 * Rate limiting helpers
 */
const rateLimitHelpers = {
  /**
   * Check and increment rate limit
   */
  checkRateLimit: async (key, windowMs, maxRequests) => {
    try {
      const rateLimitKey = `rate_limit:${key}`;
      const current = await redis.incr(rateLimitKey);
      
      if (current === 1) {
        await redis.expire(rateLimitKey, Math.ceil(windowMs / 1000));
      }
      
      return {
        current,
        remaining: Math.max(0, maxRequests - current),
        exceeded: current > maxRequests,
        resetTime: Date.now() + windowMs
      };
    } catch (error) {
      logger.error('Failed to check rate limit:', error);
      return {
        current: 0,
        remaining: maxRequests,
        exceeded: false,
        resetTime: Date.now() + windowMs
      };
    }
  },

  /**
   * Reset rate limit
   */
  resetRateLimit: async (key) => {
    try {
      const rateLimitKey = `rate_limit:${key}`;
      await redis.del(rateLimitKey);
      return true;
    } catch (error) {
      logger.error('Failed to reset rate limit:', error);
      return false;
    }
  }
};

/**
 * Pub/Sub helpers
 */
const pubSubHelpers = {
  /**
   * Publish message
   */
  publish: async (channel, message) => {
    try {
      const data = typeof message === 'string' ? message : JSON.stringify(message);
      await publisher.publish(channel, data);
      return true;
    } catch (error) {
      logger.error('Failed to publish message:', error);
      return false;
    }
  },

  /**
   * Subscribe to channel
   */
  subscribe: async (channel, callback) => {
    try {
      await subscriber.subscribe(channel);
      subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          try {
            const data = JSON.parse(message);
            callback(data);
          } catch (parseError) {
            callback(message);
          }
        }
      });
      return true;
    } catch (error) {
      logger.error('Failed to subscribe:', error);
      return false;
    }
  },

  /**
   * Unsubscribe from channel
   */
  unsubscribe: async (channel) => {
    try {
      await subscriber.unsubscribe(channel);
      return true;
    } catch (error) {
      logger.error('Failed to unsubscribe:', error);
      return false;
    }
  }
};

/**
 * Redis monitoring
 */
const startRedisMonitoring = () => {
  // Check Redis health every 30 seconds
  setInterval(async () => {
    try {
      const health = await checkRedisHealth();
      if (health.status !== 'healthy') {
        logger.warn('Redis health check failed', health);
      }
    } catch (error) {
      logger.error('Redis monitoring error:', error);
    }
  }, 30000);

  logger.info('Redis monitoring started');
};

module.exports = {
  initializeRedis,
  getRedis,
  getPublisher,
  getSubscriber,
  closeRedis,
  checkRedisHealth,
  getRedisMetrics,
  sessionHelpers,
  cacheHelpers,
  rateLimitHelpers,
  pubSubHelpers,
  startRedisMonitoring
};