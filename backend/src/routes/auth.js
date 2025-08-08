const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  generateRefreshToken,
  authenticate,
  refreshToken 
} = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { logSecurityEvent } = require('../utils/logger');
const { 
  AppError, 
  ValidationError, 
  AuthenticationError,
  ConflictError 
} = require('../utils/errors');
const config = require('../config/config');

const router = express.Router();
const prisma = new PrismaClient();

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: 'Too many authentication attempts',
    message: 'Please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logSecurityEvent('RATE_LIMIT_AUTH', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      severity: 'high'
    });
    
    res.status(429).json({
      error: 'Too many authentication attempts',
      message: 'Please try again in 15 minutes',
      retryAfter: 900
    });
  }
});

// Validation schemas
const registerValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: config.security.passwordMinLength })
    .withMessage(`Password must be at least ${config.security.passwordMinLength} characters`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be 2-50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be 2-50 characters'),
  body('title')
    .optional()
    .trim()
    .isIn(['Dr.', 'Prof.', 'Prof. Dr.', 'PD Dr.'])
    .withMessage('Invalid title'),
  body('specialization')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Specialization too long'),
  body('licenseNumber')
    .optional()
    .trim()
    .isLength({ min: 5, max: 20 })
    .withMessage('Invalid license number format'),
  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Department name too long'),
  body('institution')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Institution name too long'),
  body('gdprConsent')
    .isBoolean()
    .custom(value => {
      if (!value) {
        throw new Error('GDPR consent is required');
      }
      return true;
    })
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register new medical professional
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - firstName
 *               - lastName
 *               - gdprConsent
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               title:
 *                 type: string
 *                 enum: [Dr., Prof., Prof. Dr., PD Dr.]
 *               specialization:
 *                 type: string
 *               licenseNumber:
 *                 type: string
 *               department:
 *                 type: string
 *               institution:
 *                 type: string
 *               gdprConsent:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 */
router.post('/register', authLimiter, registerValidation, async (req, res, next) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const {
      email,
      password,
      firstName,
      lastName,
      title,
      specialization,
      licenseNumber,
      department,
      institution,
      gdprConsent
    } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { licenseNumber: licenseNumber ? licenseNumber : undefined }
        ]
      }
    });

    if (existingUser) {
      throw new ConflictError('User with this email or license number already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        title,
        specialization,
        licenseNumber,
        department,
        institution,
        gdprConsent,
        gdprConsentDate: gdprConsent ? new Date() : null,
        role: 'RESIDENT', // Default role
        isActive: true,
        isVerified: false // Require email verification
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        title: true,
        specialization: true,
        department: true,
        institution: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true
      }
    });

    // Create audit log
    await createAuditLog({
      userId: user.id,
      action: 'USER_CREATED',
      resource: 'user',
      resourceId: user.id,
      description: `New user registered: ${email}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      gdprLawfulBasis: 'consent'
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please verify your email.',
      data: { user }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login medical professional
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               rememberMe:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       423:
 *         description: Account locked
 */
router.post('/login', authLimiter, loginValidation, async (req, res, next) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { email, password, rememberMe = false } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: { permissions: true }
    });

    if (!user) {
      // Log failed login attempt
      await createAuditLog({
        action: 'LOGIN_FAILED',
        resource: 'authentication',
        description: `Login attempt with non-existent email: ${email}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        riskLevel: 'MEDIUM'
      });

      throw new AuthenticationError('Invalid email or password');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const lockTimeRemaining = Math.ceil((user.lockedUntil - new Date()) / 60000);
      
      await createAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        resource: 'authentication',
        description: 'Login attempt on locked account',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        riskLevel: 'HIGH'
      });

      throw new AuthenticationError(`Account is locked. Try again in ${lockTimeRemaining} minutes`);
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      // Increment login attempts
      const updatedUser = await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: { increment: 1 },
          lockedUntil: user.loginAttempts + 1 >= config.security.maxLoginAttempts 
            ? new Date(Date.now() + config.security.lockoutTime)
            : null
        }
      });

      await createAuditLog({
        userId: user.id,
        action: 'LOGIN_FAILED',
        resource: 'authentication',
        description: `Failed login attempt ${updatedUser.loginAttempts}/${config.security.maxLoginAttempts}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        riskLevel: updatedUser.loginAttempts >= 3 ? 'HIGH' : 'MEDIUM'
      });

      if (updatedUser.lockedUntil) {
        logSecurityEvent('ACCOUNT_LOCKED', {
          userId: user.id,
          email: user.email,
          ip: req.ip,
          severity: 'high'
        });
      }

      throw new AuthenticationError('Invalid email or password');
    }

    // Check if account is active and verified
    if (!user.isActive) {
      throw new AuthenticationError('Account is inactive');
    }

    if (!user.isVerified) {
      throw new AuthenticationError('Please verify your email address');
    }

    // Reset login attempts and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date()
      }
    });

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      role: user.role,
      email: user.email
    };

    const accessToken = generateToken(tokenPayload);
    const refreshTokenValue = generateRefreshToken({ userId: user.id });

    // Store refresh token
    const refreshTokenRecord = await prisma.refreshToken.create({
      data: {
        token: refreshTokenValue,
        userId: user.id,
        expiresAt: new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000),
        deviceId: req.headers['x-device-id'],
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    });

    // Create session
    const session = await prisma.session.create({
      data: {
        sessionToken: req.sessionID || `session_${Date.now()}`,
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        deviceId: req.headers['x-device-id'],
        expiresAt: new Date(Date.now() + config.session.maxAge)
      }
    });

    // Create audit log
    await createAuditLog({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      resource: 'authentication',
      description: 'Successful login',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: session.id
    });

    // Prepare user data for response
    const userData = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      title: user.title,
      specialization: user.specialization,
      department: user.department,
      institution: user.institution,
      role: user.role,
      permissions: user.permissions.map(p => ({
        permission: p.permission,
        resource: p.resource
      })),
      lastLogin: user.lastLogin
    };

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userData,
        accessToken,
        refreshToken: refreshTokenValue,
        expiresIn: config.jwt.expiresIn
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', refreshToken, async (req, res, next) => {
  try {
    const { accessToken, refreshToken: newRefreshToken } = req.tokens;

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken,
        refreshToken: newRefreshToken,
        expiresIn: config.jwt.expiresIn
      }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Authentication required
 */
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const sessionToken = req.headers.authorization?.substring(7); // Remove 'Bearer '

    // Revoke all refresh tokens for this user from this device
    await prisma.refreshToken.updateMany({
      where: {
        userId,
        deviceId: req.headers['x-device-id']
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedBy: userId
      }
    });

    // Terminate sessions
    await prisma.session.updateMany({
      where: {
        userId,
        isActive: true
      },
      data: {
        isActive: false,
        terminatedAt: new Date(),
        terminatedBy: userId,
        terminationReason: 'user_logout'
      }
    });

    // Create audit log
    await createAuditLog({
      userId,
      action: 'LOGOUT',
      resource: 'authentication',
      description: 'User logout',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User information retrieved
 *       401:
 *         description: Authentication required
 */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        title: true,
        specialization: true,
        licenseNumber: true,
        department: true,
        institution: true,
        role: true,
        isActive: true,
        isVerified: true,
        lastLogin: true,
        createdAt: true,
        permissions: {
          select: {
            permission: true,
            resource: true,
            conditions: true
          }
        }
      }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({
      success: true,
      data: { user }
    });

  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       401:
 *         description: Invalid current password
 */
router.post('/change-password', authenticate, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: config.security.passwordMinLength })
    .withMessage(`Password must be at least ${config.security.passwordMinLength} characters`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character')
], async (req, res, next) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new ValidationError('Validation failed', errors.array());
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      await createAuditLog({
        userId,
        action: 'PASSWORD_CHANGE_FAILED',
        resource: 'authentication',
        description: 'Failed password change attempt - invalid current password',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        riskLevel: 'MEDIUM'
      });

      throw new AuthenticationError('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });

    // Revoke all refresh tokens (force re-login on all devices)
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedBy: userId
      }
    });

    // Create audit log
    await createAuditLog({
      userId,
      action: 'PASSWORD_CHANGED',
      resource: 'authentication',
      description: 'Password changed successfully',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.json({
      success: true,
      message: 'Password changed successfully. Please log in again on all devices.'
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router;