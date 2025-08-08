const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const config = require('../config/config');
const logger = require('../utils/logger');
const { createAuditLog } = require('../utils/audit');
const { AppError } = require('../utils/errors');

const prisma = new PrismaClient();

/**
 * Generate JWT token
 */
const generateToken = (payload, expiresIn = config.jwt.expiresIn) => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    algorithm: config.jwt.algorithm
  });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    algorithm: config.jwt.algorithm
  });
};

/**
 * Verify JWT token
 */
const verifyToken = (token, secret = config.jwt.secret) => {
  try {
    return jwt.verify(token, secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      algorithms: [config.jwt.algorithm]
    });
  } catch (error) {
    throw new AppError('Invalid or expired token', 401, 'TOKEN_INVALID');
  }
};

/**
 * Hash password
 */
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(config.security.bcryptSaltRounds);
  return bcrypt.hash(password, salt);
};

/**
 * Compare password
 */
const comparePassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

/**
 * Authentication middleware
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];

    // Check for Bearer token
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return authenticateWithJWT(req, res, next, token);
    }

    // Check for API key
    if (apiKey) {
      return authenticateWithApiKey(req, res, next, apiKey);
    }

    // No authentication provided
    throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');

  } catch (error) {
    logger.error('Authentication error:', error);
    
    // Create audit log for failed authentication
    await createAuditLog({
      action: 'UNAUTHORIZED_ACCESS',
      resource: 'authentication',
      description: `Authentication failed: ${error.message}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      requestBody: { endpoint: req.path, method: req.method },
      riskLevel: 'HIGH'
    });

    return res.status(401).json({
      error: 'Authentication failed',
      message: error.message,
      code: error.code || 'AUTH_FAILED'
    });
  }
};

/**
 * JWT authentication
 */
const authenticateWithJWT = async (req, res, next, token) => {
  try {
    const decoded = verifyToken(token);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        permissions: true,
        sessions: {
          where: {
            isActive: true,
            expiresAt: { gt: new Date() }
          }
        }
      }
    });

    if (!user) {
      throw new AppError('User not found', 401, 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      throw new AppError('Account is inactive', 401, 'ACCOUNT_INACTIVE');
    }

    if (!user.isVerified) {
      throw new AppError('Account is not verified', 401, 'ACCOUNT_NOT_VERIFIED');
    }

    // Check if user is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError('Account is locked', 401, 'ACCOUNT_LOCKED');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions.map(p => ({
        permission: p.permission,
        resource: p.resource,
        conditions: p.conditions
      })),
      firstName: user.firstName,
      lastName: user.lastName,
      specialization: user.specialization,
      department: user.department,
      institution: user.institution
    };

    next();

  } catch (error) {
    throw new AppError('Invalid token', 401, 'TOKEN_INVALID');
  }
};

/**
 * API Key authentication
 */
const authenticateWithApiKey = async (req, res, next, apiKey) => {
  try {
    // Hash the API key to compare with stored hash
    const keyHash = await bcrypt.hash(apiKey, 10);
    
    const apiKeyRecord = await prisma.apiKey.findFirst({
      where: {
        keyHash: {
          // We need to check all hashes since we can't reverse hash
          // In production, consider using a more efficient lookup method
        },
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        user: {
          include: {
            permissions: true
          }
        }
      }
    });

    if (!apiKeyRecord) {
      throw new AppError('Invalid API key', 401, 'INVALID_API_KEY');
    }

    // Verify the API key hash
    const isValidKey = await bcrypt.compare(apiKey, apiKeyRecord.keyHash);
    if (!isValidKey) {
      throw new AppError('Invalid API key', 401, 'INVALID_API_KEY');
    }

    // Update usage statistics
    await prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: {
        lastUsed: new Date(),
        usageCount: { increment: 1 }
      }
    });

    // Attach user to request
    req.user = {
      id: apiKeyRecord.user.id,
      email: apiKeyRecord.user.email,
      role: apiKeyRecord.user.role,
      permissions: apiKeyRecord.user.permissions.map(p => ({
        permission: p.permission,
        resource: p.resource,
        conditions: p.conditions
      })),
      apiKeyId: apiKeyRecord.id,
      apiKeyScopes: apiKeyRecord.scopes
    };

    next();

  } catch (error) {
    throw new AppError('API key authentication failed', 401, 'API_KEY_AUTH_FAILED');
  }
};

/**
 * Role-based authorization middleware
 */
const authorize = (roles = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
      }

      // Convert single role to array
      if (typeof roles === 'string') {
        roles = [roles];
      }

      // Check if user has required role
      if (roles.length > 0 && !roles.includes(req.user.role)) {
        logger.warn(`Authorization failed for user ${req.user.id}`, {
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: roles,
          endpoint: req.path
        });

        throw new AppError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
      }

      next();

    } catch (error) {
      logger.error('Authorization error:', error);
      return res.status(error.statusCode || 403).json({
        error: 'Authorization failed',
        message: error.message,
        code: error.code || 'AUTH_FAILED'
      });
    }
  };
};

/**
 * Permission-based authorization middleware
 */
const requirePermission = (permission, resource = null) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'AUTH_REQUIRED');
      }

      // Check if user has the required permission
      const hasPermission = req.user.permissions.some(p => {
        if (p.permission !== permission) {
          return false;
        }

        // If resource is specified, check if permission applies to this resource
        if (resource && p.resource && p.resource !== resource) {
          return false;
        }

        // Check conditions if they exist
        if (p.conditions) {
          return evaluatePermissionConditions(p.conditions, req);
        }

        return true;
      });

      if (!hasPermission) {
        logger.warn(`Permission denied for user ${req.user.id}`, {
          userId: req.user.id,
          requiredPermission: permission,
          resource,
          userPermissions: req.user.permissions.map(p => p.permission),
          endpoint: req.path
        });

        throw new AppError('Permission denied', 403, 'PERMISSION_DENIED');
      }

      next();

    } catch (error) {
      logger.error('Permission check error:', error);
      return res.status(error.statusCode || 403).json({
        error: 'Permission check failed',
        message: error.message,
        code: error.code || 'PERMISSION_FAILED'
      });
    }
  };
};

/**
 * Evaluate permission conditions
 */
const evaluatePermissionConditions = (conditions, req) => {
  try {
    // Simple condition evaluation
    // In production, implement a more robust condition evaluator
    if (conditions.department && conditions.department !== req.user.department) {
      return false;
    }

    if (conditions.institution && conditions.institution !== req.user.institution) {
      return false;
    }

    if (conditions.timeRestriction) {
      const now = new Date();
      const startTime = new Date(conditions.timeRestriction.start);
      const endTime = new Date(conditions.timeRestriction.end);
      
      if (now < startTime || now > endTime) {
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error('Error evaluating permission conditions:', error);
    return false;
  }
};

/**
 * Optional authentication middleware (doesn't fail if no auth provided)
 */
const optionalAuth = async (req, res, next) => {
  try {
    await authenticate(req, res, () => {});
  } catch (error) {
    // Continue without authentication
  }
  next();
};

/**
 * Refresh token middleware
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new AppError('Refresh token required', 400, 'REFRESH_TOKEN_REQUIRED');
    }

    // Verify refresh token
    const decoded = verifyToken(refreshToken, config.jwt.refreshSecret);

    // Check if refresh token exists and is not revoked
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!tokenRecord || tokenRecord.isRevoked) {
      throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new AppError('Refresh token expired', 401, 'REFRESH_TOKEN_EXPIRED');
    }

    // Generate new tokens
    const newAccessToken = generateToken({
      userId: tokenRecord.user.id,
      role: tokenRecord.user.role
    });

    const newRefreshToken = generateRefreshToken({
      userId: tokenRecord.user.id
    });

    // Revoke old refresh token and create new one
    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: tokenRecord.id },
        data: { isRevoked: true, revokedAt: new Date() }
      }),
      prisma.refreshToken.create({
        data: {
          token: newRefreshToken,
          userId: tokenRecord.user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          deviceId: req.headers['x-device-id'],
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      })
    ]);

    req.tokens = {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };

    next();

  } catch (error) {
    logger.error('Token refresh error:', error);
    return res.status(error.statusCode || 401).json({
      error: 'Token refresh failed',
      message: error.message,
      code: error.code || 'TOKEN_REFRESH_FAILED'
    });
  }
};

module.exports = {
  authenticate,
  authorize,
  requirePermission,
  optionalAuth,
  refreshToken,
  generateToken,
  generateRefreshToken,
  verifyToken,
  hashPassword,
  comparePassword
};