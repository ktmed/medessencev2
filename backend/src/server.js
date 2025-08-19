const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
require('dotenv').config();

// Import custom modules
const config = require('./config/config');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { requestLogger, responseLogger } = require('./middleware/requestLogger');
const { securityMiddleware } = require('./middleware/security');
const { healthCheck } = require('./middleware/healthCheck');
const { metricsMiddleware } = require('./middleware/metrics');
const { auditMiddleware } = require('./middleware/audit');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const proxyRoutes = require('./routes/proxy');
const healthRoutes = require('./routes/health');
const metricsRoutes = require('./routes/metrics');
const auditRoutes = require('./routes/audit');
const reportsRoutes = require('./routes/reports');

// Import WebSocket handlers
const { setupWebSocketProxy } = require('./websocket/proxy');
const { setupWebSocketAuth } = require('./websocket/auth');

// Import database and Redis connections
const { initializeDatabase } = require('./database/connection');
const { initializeRedis } = require('./redis/connection');

class RadiologyAIGateway {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: config.cors.origins,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupErrorHandling();
  }

  setupMiddleware() {
    // Security middleware (must be first)
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: config.cors.origins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count']
    }));

    // Compression
    this.app.use(compression());

    // Request parsing
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use(morgan('combined', {
      stream: { write: message => logger.info(message.trim()) }
    }));

    // Custom middleware
    this.app.use(requestLogger);
    this.app.use(securityMiddleware);
    this.app.use(auditMiddleware);
    this.app.use(metricsMiddleware);

    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimiting.windowMs,
      max: config.rateLimiting.maxRequests,
      message: {
        error: 'Too many requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.ceil(config.rateLimiting.windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        });
        res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(config.rateLimiting.windowMs / 1000)
        });
      }
    });
    this.app.use('/api', limiter);

    // Health check endpoint (no rate limiting)
    this.app.use('/health', healthCheck);
  }

  setupRoutes() {
    // API routes
    this.app.use('/api/v1/auth', authRoutes);
    this.app.use('/api/v1/users', userRoutes);
    this.app.use('/api/v1/health', healthRoutes);
    this.app.use('/api/v1/metrics', metricsRoutes);
    this.app.use('/api/v1/audit', auditRoutes);

    // Direct report generation routes (local processing)
    this.app.use('/api', reportsRoutes);

    // Service proxy routes (protected)
    this.app.use('/api/v1/transcription', proxyRoutes.transcription);
    this.app.use('/api/v1/reports', proxyRoutes.reports);
    this.app.use('/api/v1/summaries', proxyRoutes.summaries);

    // API documentation
    if (config.swagger.enabled) {
      const swaggerUi = require('swagger-ui-express');
      const swaggerSpec = require('./docs/swagger');
      
      this.app.use('/docs', swaggerUi.serve);
      this.app.get('/docs', swaggerUi.setup(swaggerSpec, {
        explorer: true,
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Radiology AI Gateway API'
      }));
    }

    // Root route
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Radiology AI Gateway',
        version: '1.0.0',
        status: 'operational',
        timestamp: new Date().toISOString(),
        environment: config.nodeEnv,
        docs: config.swagger.enabled ? '/docs' : null
      });
    });
  }

  setupWebSocket() {
    // WebSocket authentication
    setupWebSocketAuth(this.io);

    // WebSocket proxy for real-time features
    setupWebSocketProxy(this.io);

    // Connection handling
    this.io.on('connection', (socket) => {
      logger.info(`WebSocket client connected: ${socket.id}`, {
        socketId: socket.id,
        userId: socket.userId,
        userAgent: socket.handshake.headers['user-agent']
      });

      socket.on('disconnect', (reason) => {
        logger.info(`WebSocket client disconnected: ${socket.id}`, {
          socketId: socket.id,
          userId: socket.userId,
          reason
        });
      });

      socket.on('error', (error) => {
        logger.error(`WebSocket error for client ${socket.id}:`, {
          socketId: socket.id,
          userId: socket.userId,
          error: error.message
        });
      });
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use(notFoundHandler);

    // Global error handler
    this.app.use(errorHandler);

    // Response logger (after error handling)
    this.app.use(responseLogger);

    // Graceful shutdown handling
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      this.gracefulShutdown();
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      this.gracefulShutdown();
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown(1);
    });
  }

  async gracefulShutdown(exitCode = 0) {
    try {
      logger.info('Starting graceful shutdown...');

      // Close HTTP server
      await new Promise((resolve) => {
        this.server.close(resolve);
      });

      // Close WebSocket connections
      this.io.close();

      // Close database connections
      const { closeDatabase } = require('./database/connection');
      await closeDatabase();

      // Close Redis connections
      const { closeRedis } = require('./redis/connection');
      await closeRedis();

      logger.info('Graceful shutdown completed');
      process.exit(exitCode);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  async start() {
    try {
      // Initialize database
      await initializeDatabase();
      logger.info('Database initialized successfully');

      // Initialize Redis
      await initializeRedis();
      logger.info('Redis initialized successfully');

      // Start server
      const port = config.port;
      this.server.listen(port, () => {
        logger.info(`Radiology AI Gateway started on port ${port}`, {
          environment: config.nodeEnv,
          port,
          timestamp: new Date().toISOString()
        });

        // Log startup information
        logger.info('Service configuration:', {
          transcriptionService: config.services.transcription.url,
          reportService: config.services.reports.url,
          summaryService: config.services.summaries.url,
          redisConnected: true,
          databaseConnected: true
        });
      });

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const gateway = new RadiologyAIGateway();
  gateway.start();
}

module.exports = RadiologyAIGateway;