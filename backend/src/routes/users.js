const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize, requirePermission } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { hashPassword } = require('../middleware/auth');
const { 
  AppError, 
  ValidationError, 
  NotFoundError,
  ConflictError,
  AuthorizationError 
} = require('../utils/errors');

const router = express.Router();
const prisma = new PrismaClient();

// All user routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: Get list of users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *       403:
 *         description: Insufficient permissions
 */
router.get('/', 
  requirePermission('USER_READ'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('role').optional().isIn(['ADMIN', 'CHIEF_RADIOLOGIST', 'SENIOR_RADIOLOGIST', 'RADIOLOGIST', 'RESIDENT', 'TECHNICIAN', 'VIEWER', 'GUEST']),
    query('department').optional().trim(),
    query('search').optional().trim()
  ],
  async (req, res, next) => {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const {
        page = 1,
        limit = 20,
        role,
        department,
        search
      } = req.query;

      // Build where clause
      const where = {
        deletedAt: null // Exclude soft-deleted users
      };

      if (role) {
        where.role = role;
      }

      if (department) {
        where.department = department;
      }

      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { specialization: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Only admins can see all users, others see only same department
      if (req.user.role !== 'ADMIN' && req.user.role !== 'CHIEF_RADIOLOGIST') {
        where.department = req.user.department;
      }

      // Get users with pagination
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
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
            lastLogin: true,
            createdAt: true,
            permissions: {
              select: {
                permission: true,
                resource: true,
                expiresAt: true
              }
            }
          },
          orderBy: [
            { lastName: 'asc' },
            { firstName: 'asc' }
          ],
          skip: (page - 1) * limit,
          take: limit
        }),
        prisma.user.count({ where })
      ]);

      // Create audit log
      await createAuditLog({
        userId: req.user.id,
        action: 'USER_ACCESSED',
        resource: 'user',
        description: `Retrieved user list (page ${page}, ${users.length} users)`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *       404:
 *         description: User not found
 */
router.get('/:id',
  [param('id').isString().notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { id } = req.params;

      // Check if user can access this user's data
      if (req.user.id !== id && 
          req.user.role !== 'ADMIN' && 
          req.user.role !== 'CHIEF_RADIOLOGIST') {
        // Check if same department
        const targetUser = await prisma.user.findUnique({
          where: { id },
          select: { department: true }
        });

        if (!targetUser || targetUser.department !== req.user.department) {
          throw new AuthorizationError('Access denied');
        }
      }

      const user = await prisma.user.findUnique({
        where: { 
          id,
          deletedAt: null
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          title: true,
          specialization: true,
          licenseNumber: req.user.role === 'ADMIN' ? true : false,
          department: true,
          institution: true,
          role: true,
          isActive: true,
          isVerified: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true,
          permissions: {
            select: {
              permission: true,
              resource: true,
              conditions: true,
              expiresAt: true,
              grantedBy: true,
              grantedAt: true
            }
          },
          sessions: req.user.id === id ? {
            where: { isActive: true },
            select: {
              id: true,
              deviceId: true,
              lastActivity: true,
              createdAt: true
            }
          } : false
        }
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Create audit log
      await createAuditLog({
        userId: req.user.id,
        action: 'USER_ACCESSED',
        resource: 'user',
        resourceId: id,
        description: `Accessed user profile: ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: { user }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Create new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - firstName
 *               - lastName
 *               - role
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               title:
 *                 type: string
 *               role:
 *                 type: string
 *               department:
 *                 type: string
 *               institution:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       403:
 *         description: Insufficient permissions
 */
router.post('/',
  requirePermission('USER_CREATE'),
  [
    body('email').isEmail().normalizeEmail(),
    body('firstName').trim().isLength({ min: 2, max: 50 }),
    body('lastName').trim().isLength({ min: 2, max: 50 }),
    body('title').optional().trim().isIn(['Dr.', 'Prof.', 'Prof. Dr.', 'PD Dr.']),
    body('role').isIn(['ADMIN', 'CHIEF_RADIOLOGIST', 'SENIOR_RADIOLOGIST', 'RADIOLOGIST', 'RESIDENT', 'TECHNICIAN', 'VIEWER', 'GUEST']),
    body('specialization').optional().trim().isLength({ max: 100 }),
    body('licenseNumber').optional().trim().isLength({ min: 5, max: 20 }),
    body('department').optional().trim().isLength({ max: 100 }),
    body('institution').optional().trim().isLength({ max: 200 })
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const {
        email,
        firstName,
        lastName,
        title,
        role,
        specialization,
        licenseNumber,
        department,
        institution
      } = req.body;

      // Check role hierarchy - users can't create users with higher privileges
      const roleHierarchy = {
        'GUEST': 0,
        'VIEWER': 1,
        'TECHNICIAN': 2,
        'RESIDENT': 3,
        'RADIOLOGIST': 4,
        'SENIOR_RADIOLOGIST': 5,
        'CHIEF_RADIOLOGIST': 6,
        'ADMIN': 7
      };

      if (roleHierarchy[role] >= roleHierarchy[req.user.role]) {
        throw new AuthorizationError('Cannot create user with equal or higher privileges');
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Generate temporary password
      const tempPassword = Math.random().toString(36).slice(-12) + 'Aa1!';
      const passwordHash = await hashPassword(tempPassword);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          title,
          role,
          specialization,
          licenseNumber,
          department: department || req.user.department,
          institution: institution || req.user.institution,
          isActive: true,
          isVerified: false,
          gdprConsent: true, // Implied for medical professionals
          gdprConsentDate: new Date()
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          title: true,
          role: true,
          specialization: true,
          department: true,
          institution: true,
          isActive: true,
          isVerified: true,
          createdAt: true
        }
      });

      // Create audit log
      await createAuditLog({
        userId: req.user.id,
        action: 'USER_CREATED',
        resource: 'user',
        resourceId: user.id,
        description: `Created new user: ${email} with role ${role}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully. Temporary password will be sent via email.',
        data: { 
          user,
          tempPassword: process.env.NODE_ENV === 'development' ? tempPassword : undefined
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 */
router.put('/:id',
  [
    param('id').isString().notEmpty(),
    body('firstName').optional().trim().isLength({ min: 2, max: 50 }),
    body('lastName').optional().trim().isLength({ min: 2, max: 50 }),
    body('title').optional().trim().isIn(['Dr.', 'Prof.', 'Prof. Dr.', 'PD Dr.']),
    body('specialization').optional().trim().isLength({ max: 100 }),
    body('department').optional().trim().isLength({ max: 100 }),
    body('institution').optional().trim().isLength({ max: 200 }),
    body('role').optional().isIn(['ADMIN', 'CHIEF_RADIOLOGIST', 'SENIOR_RADIOLOGIST', 'RADIOLOGIST', 'RESIDENT', 'TECHNICIAN', 'VIEWER', 'GUEST'])
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { id } = req.params;
      const updateData = req.body;

      // Check if user can update this user
      const canEdit = req.user.id === id || 
                     req.user.role === 'ADMIN' || 
                     req.user.role === 'CHIEF_RADIOLOGIST';

      if (!canEdit) {
        throw new AuthorizationError('Cannot update this user');
      }

      // If updating role, check permissions
      if (updateData.role && req.user.id !== id) {
        if (!['ADMIN', 'CHIEF_RADIOLOGIST'].includes(req.user.role)) {
          throw new AuthorizationError('Cannot change user roles');
        }

        const roleHierarchy = {
          'GUEST': 0, 'VIEWER': 1, 'TECHNICIAN': 2, 'RESIDENT': 3,
          'RADIOLOGIST': 4, 'SENIOR_RADIOLOGIST': 5, 'CHIEF_RADIOLOGIST': 6, 'ADMIN': 7
        };

        if (roleHierarchy[updateData.role] >= roleHierarchy[req.user.role]) {
          throw new AuthorizationError('Cannot assign equal or higher privileges');
        }
      }

      // Get current user data
      const currentUser = await prisma.user.findUnique({
        where: { id, deletedAt: null }
      });

      if (!currentUser) {
        throw new NotFoundError('User not found');
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          ...updateData,
          updatedAt: new Date()
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          title: true,
          role: true,
          specialization: true,
          department: true,
          institution: true,
          isActive: true,
          isVerified: true,
          updatedAt: true
        }
      });

      // Create audit log
      await createAuditLog({
        userId: req.user.id,
        action: 'USER_UPDATED',
        resource: 'user',
        resourceId: id,
        description: `Updated user: ${updatedUser.email}`,
        requestBody: updateData,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'User updated successfully',
        data: { user: updatedUser }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/users/{id}/permissions:
 *   post:
 *     summary: Grant permission to user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Permission granted successfully
 */
router.post('/:id/permissions',
  requirePermission('USER_ADMIN'),
  [
    param('id').isString().notEmpty(),
    body('permission').notEmpty(),
    body('resource').optional(),
    body('conditions').optional(),
    body('expiresAt').optional().isISO8601()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { id } = req.params;
      const { permission, resource, conditions, expiresAt } = req.body;

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id, deletedAt: null }
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Create or update permission
      const userPermission = await prisma.userPermission.upsert({
        where: {
          userId_permission_resource: {
            userId: id,
            permission,
            resource: resource || null
          }
        },
        update: {
          conditions,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          grantedBy: req.user.id,
          grantedAt: new Date()
        },
        create: {
          userId: id,
          permission,
          resource,
          conditions,
          grantedBy: req.user.id,
          expiresAt: expiresAt ? new Date(expiresAt) : null
        }
      });

      // Create audit log
      await createAuditLog({
        userId: req.user.id,
        action: 'PERMISSION_GRANTED',
        resource: 'user',
        resourceId: id,
        description: `Granted permission ${permission} to user ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Permission granted successfully',
        data: { permission: userPermission }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/users/{id}/deactivate:
 *   post:
 *     summary: Deactivate user account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deactivated successfully
 */
router.post('/:id/deactivate',
  requirePermission('USER_ADMIN'),
  [param('id').isString().notEmpty()],
  async (req, res, next) => {
    try {
      const { id } = req.params;

      if (id === req.user.id) {
        throw new ValidationError('Cannot deactivate your own account');
      }

      const user = await prisma.user.findUnique({
        where: { id, deletedAt: null }
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Deactivate user
      await prisma.user.update({
        where: { id },
        data: { isActive: false }
      });

      // Revoke all refresh tokens
      await prisma.refreshToken.updateMany({
        where: { userId: id },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedBy: req.user.id
        }
      });

      // Terminate all sessions
      await prisma.session.updateMany({
        where: { userId: id, isActive: true },
        data: {
          isActive: false,
          terminatedAt: new Date(),
          terminatedBy: req.user.id,
          terminationReason: 'admin_deactivation'
        }
      });

      // Create audit log
      await createAuditLog({
        userId: req.user.id,
        action: 'USER_DEACTIVATED',
        resource: 'user',
        resourceId: id,
        description: `Deactivated user account: ${user.email}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        riskLevel: 'MEDIUM'
      });

      res.json({
        success: true,
        message: 'User deactivated successfully'
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;