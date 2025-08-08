const path = require('path');
require('dotenv').config();

const config = {
  // Environment
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  apiVersion: process.env.API_VERSION || 'v1',
  appName: process.env.APP_NAME || 'Radiology AI Gateway',

  // Database
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT, 10) || 5432,
    username: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    pool: {
      min: 2,
      max: 10,
      acquire: 30000,
      idle: 10000
    }
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || null,
    retryDelayOnFailover: 100,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    lazyConnect: true,
    keepAlive: 30000,
    family: 4,
    db: 0
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_EXPIRE_TIME || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE_TIME || '7d',
    issuer: process.env.JWT_ISSUER || 'radiology-ai-system',
    audience: process.env.JWT_AUDIENCE || 'medical-professionals',
    algorithm: 'HS256'
  },

  // Session Configuration
  session: {
    secret: process.env.SESSION_SECRET,
    maxAge: parseInt(process.env.SESSION_MAX_AGE, 10) || 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict'
  },

  // Microservices
  services: {
    transcription: {
      url: process.env.TRANSCRIPTION_SERVICE_URL || 'http://localhost:8001',
      timeout: parseInt(process.env.SERVICE_TIMEOUT, 10) || 30000,
      retries: 3,
      retryDelay: 1000
    },
    reports: {
      url: process.env.REPORT_GENERATION_SERVICE_URL || 'http://localhost:8002',
      timeout: parseInt(process.env.SERVICE_TIMEOUT, 10) || 30000,
      retries: 3,
      retryDelay: 1000
    },
    summaries: {
      url: process.env.SUMMARY_GENERATION_SERVICE_URL || 'http://localhost:8003',
      timeout: parseInt(process.env.SERVICE_TIMEOUT, 10) || 30000,
      retries: 3,
      retryDelay: 1000
    }
  },

  // WebSocket Configuration
  websocket: {
    port: parseInt(process.env.WEBSOCKET_PORT, 10) || 3001,
    cors: {
      origins: process.env.WEBSOCKET_CORS_ORIGINS?.split(',') || ['http://localhost:3000']
    },
    pingTimeout: 60000,
    pingInterval: 25000
  },

  // Security Configuration
  security: {
    bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,
    maxLoginAttempts: 5,
    lockoutTime: 15 * 60 * 1000, // 15 minutes
    passwordMinLength: 8,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true
  },

  // Rate Limiting
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    standardHeaders: true,
    legacyHeaders: false
  },

  // CORS Configuration
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs',
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: process.env.LOG_MAX_FILES || '14d',
    datePattern: process.env.LOG_DATE_PATTERN || 'YYYY-MM-DD',
    format: process.env.NODE_ENV === 'production' ? 'json' : 'simple'
  },

  // Health Check Configuration
  healthCheck: {
    interval: parseInt(process.env.HEALTH_CHECK_INTERVAL, 10) || 30000,
    timeout: parseInt(process.env.SERVICE_TIMEOUT, 10) || 5000,
    retries: 3
  },

  // Metrics Configuration
  metrics: {
    enabled: process.env.METRICS_ENABLED === 'true',
    port: parseInt(process.env.METRICS_PORT, 10) || 9090,
    endpoint: '/metrics',
    collectDefaultMetrics: true,
    prefix: 'radiology_ai_gateway_'
  },

  // Audit Configuration
  audit: {
    enabled: process.env.AUDIT_LOG_ENABLED === 'true',
    retentionDays: parseInt(process.env.AUDIT_LOG_RETENTION_DAYS, 10) || 2555, // 7 years
    encrypt: process.env.AUDIT_LOG_ENCRYPT === 'true',
    sensitiveFields: ['password', 'token', 'apiKey', 'personalData']
  },

  // Medical Compliance
  medical: {
    gdprCompliance: process.env.GDPR_COMPLIANCE === 'true',
    dataEncryption: process.env.MEDICAL_DATA_ENCRYPTION === 'true',
    auditTrailRequired: process.env.AUDIT_TRAIL_REQUIRED === 'true',
    dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS, 10) || 3650, // 10 years
    anonymizationRequired: true,
    consentRequired: true
  },

  // Circuit Breaker Configuration
  circuitBreaker: {
    timeout: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT, 10) || 3000,
    errorThresholdPercentage: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD, 10) || 50,
    resetTimeout: parseInt(process.env.CIRCUIT_BREAKER_RESET_TIMEOUT, 10) || 60000,
    requestVolumeThreshold: 20,
    sleepWindow: 5000,
    rollingCountTimeout: 10000,
    rollingCountBuckets: 10
  },

  // Swagger Documentation
  swagger: {
    enabled: process.env.SWAGGER_ENABLED === 'true',
    title: process.env.SWAGGER_TITLE || 'Radiology AI Gateway API',
    description: process.env.SWAGGER_DESCRIPTION || 'Medical-grade API Gateway for Radiology AI System',
    version: process.env.SWAGGER_VERSION || '1.0.0',
    basePath: '/api/v1',
    schemes: process.env.NODE_ENV === 'production' ? ['https'] : ['http', 'https'],
    host: process.env.NODE_ENV === 'production' ? 'api.radiology-ai.com' : 'localhost:3000'
  },

  // Development Configuration
  development: {
    debug: process.env.DEBUG === 'true',
    mockServices: process.env.MOCK_SERVICES === 'true',
    seedDatabase: true,
    enableCors: true
  },

  // File Upload Configuration
  upload: {
    maxFileSize: 50 * 1024 * 1024, // 50MB
    allowedMimeTypes: [
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/ogg',
      'audio/webm',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'text/plain'
    ],
    uploadDir: path.join(__dirname, '../../uploads'),
    tempDir: path.join(__dirname, '../../temp')
  },

  // Encryption Configuration
  encryption: {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    iterations: 100000
  }
};

// Validation
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SESSION_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

// Security validation
if (config.jwt.secret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

if (config.jwt.refreshSecret.length < 32) {
  throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
}

if (config.session.secret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters long');
}

module.exports = config;