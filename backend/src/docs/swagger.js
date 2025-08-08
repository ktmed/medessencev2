const swaggerJsdoc = require('swagger-jsdoc');
const config = require('../config/config');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: config.swagger.title,
      version: config.swagger.version,
      description: config.swagger.description,
      contact: {
        name: 'Medical AI Team',
        email: 'support@radiology-ai.com',
        url: 'https://radiology-ai.com'
      },
      license: {
        name: 'Proprietary',
        url: 'https://radiology-ai.com/license'
      },
      termsOfService: 'https://radiology-ai.com/terms'
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? `https://${config.swagger.host}` 
          : `http://${config.swagger.host}`,
        description: process.env.NODE_ENV === 'production' 
          ? 'Production server' 
          : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header using the Bearer scheme'
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for service-to-service communication'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique user identifier'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            firstName: {
              type: 'string',
              description: 'User first name'
            },
            lastName: {
              type: 'string',
              description: 'User last name'
            },
            title: {
              type: 'string',
              enum: ['Dr.', 'Prof.', 'Prof. Dr.', 'PD Dr.'],
              description: 'Medical title'
            },
            role: {
              type: 'string',
              enum: [
                'ADMIN',
                'CHIEF_RADIOLOGIST',
                'SENIOR_RADIOLOGIST',
                'RADIOLOGIST',
                'RESIDENT',
                'TECHNICIAN',
                'VIEWER',
                'GUEST'
              ],
              description: 'User role in the system'
            },
            specialization: {
              type: 'string',
              description: 'Medical specialization'
            },
            department: {
              type: 'string',
              description: 'Hospital department'
            },
            institution: {
              type: 'string',
              description: 'Medical institution'
            },
            isActive: {
              type: 'boolean',
              description: 'Whether the user account is active'
            },
            isVerified: {
              type: 'boolean',
              description: 'Whether the user email is verified'
            },
            lastLogin: {
              type: 'string',
              format: 'date-time',
              description: 'Last login timestamp'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation timestamp'
            }
          }
        },
        Permission: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Permission identifier'
            },
            permission: {
              type: 'string',
              description: 'Permission type'
            },
            resource: {
              type: 'string',
              nullable: true,
              description: 'Resource the permission applies to'
            },
            conditions: {
              type: 'object',
              nullable: true,
              description: 'Additional permission conditions'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              description: 'Permission expiration date'
            }
          }
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Audit log identifier'
            },
            action: {
              type: 'string',
              description: 'Action performed'
            },
            resource: {
              type: 'string',
              description: 'Resource affected'
            },
            resourceId: {
              type: 'string',
              nullable: true,
              description: 'Specific resource identifier'
            },
            description: {
              type: 'string',
              description: 'Human-readable description'
            },
            userId: {
              type: 'string',
              nullable: true,
              description: 'User who performed the action'
            },
            ipAddress: {
              type: 'string',
              nullable: true,
              description: 'IP address of the request'
            },
            userAgent: {
              type: 'string',
              nullable: true,
              description: 'User agent string'
            },
            riskLevel: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
              description: 'Risk level of the action'
            },
            flagged: {
              type: 'boolean',
              description: 'Whether the log is flagged for review'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Log creation timestamp'
            }
          }
        },
        HealthCheck: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['healthy', 'degraded', 'unhealthy'],
              description: 'Overall health status'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Health check timestamp'
            },
            service: {
              type: 'string',
              description: 'Service name'
            },
            version: {
              type: 'string',
              description: 'Service version'
            },
            uptime: {
              type: 'number',
              description: 'Service uptime in seconds'
            },
            checks: {
              type: 'object',
              description: 'Individual health check results'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type'
            },
            message: {
              type: 'string',
              description: 'Error message'
            },
            code: {
              type: 'string',
              description: 'Error code'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Error timestamp'
            },
            correlationId: {
              type: 'string',
              description: 'Request correlation ID'
            }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address'
            },
            password: {
              type: 'string',
              description: 'User password'
            },
            rememberMe: {
              type: 'boolean',
              default: false,
              description: 'Whether to remember the login'
            }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean'
            },
            message: {
              type: 'string'
            },
            data: {
              type: 'object',
              properties: {
                user: {
                  $ref: '#/components/schemas/User'
                },
                accessToken: {
                  type: 'string',
                  description: 'JWT access token'
                },
                refreshToken: {
                  type: 'string',
                  description: 'JWT refresh token'
                },
                expiresIn: {
                  type: 'string',
                  description: 'Token expiration time'
                }
              }
            }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['email', 'password', 'firstName', 'lastName', 'gdprConsent'],
          properties: {
            email: {
              type: 'string',
              format: 'email'
            },
            password: {
              type: 'string',
              minLength: 8
            },
            firstName: {
              type: 'string',
              minLength: 2,
              maxLength: 50
            },
            lastName: {
              type: 'string',
              minLength: 2,
              maxLength: 50
            },
            title: {
              type: 'string',
              enum: ['Dr.', 'Prof.', 'Prof. Dr.', 'PD Dr.']
            },
            specialization: {
              type: 'string',
              maxLength: 100
            },
            licenseNumber: {
              type: 'string',
              minLength: 5,
              maxLength: 20
            },
            department: {
              type: 'string',
              maxLength: 100
            },
            institution: {
              type: 'string',
              maxLength: 200
            },
            gdprConsent: {
              type: 'boolean',
              description: 'GDPR consent required'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization endpoints'
      },
      {
        name: 'Users',
        description: 'User management endpoints'
      },
      {
        name: 'Health',
        description: 'System health monitoring endpoints'
      },
      {
        name: 'Metrics',
        description: 'Performance and usage metrics endpoints'
      },
      {
        name: 'Audit',
        description: 'Audit logging and compliance endpoints'
      },
      {
        name: 'Proxy',
        description: 'Microservice proxy endpoints'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/server.js'
  ]
};

// Generate swagger specification
const specs = swaggerJsdoc(options);

// Add additional documentation
specs.info.additionalProperties = {
  'x-logo': {
    url: 'https://radiology-ai.com/logo.png',
    altText: 'Radiology AI Logo'
  }
};

// Add security documentation
specs.components.securitySchemes.bearerAuth.description = `
JWT Bearer token authentication. 

To obtain a token:
1. POST to /api/v1/auth/login with valid credentials
2. Use the returned accessToken in the Authorization header
3. Format: "Authorization: Bearer <token>"

Token expires after ${config.jwt.expiresIn}. Use the refresh token to obtain a new access token.
`;

// Add rate limiting information
specs.info['x-rateLimit'] = {
  description: 'API endpoints are rate limited',
  limits: {
    general: `${config.rateLimiting.maxRequests} requests per ${config.rateLimiting.windowMs / 60000} minutes`,
    authentication: '5 requests per 15 minutes',
    sensitive: '10 requests per 15 minutes'
  }
};

// Add compliance information
specs.info['x-compliance'] = {
  gdpr: config.medical.gdprCompliance,
  medical: true,
  auditLogging: config.audit.enabled,
  dataRetention: `${config.medical.dataRetentionDays} days`,
  encryption: config.medical.dataEncryption
};

module.exports = specs;