const express = require('express');
const { query, param, validationResult } = require('express-validator');
const { authenticate, requirePermission } = require('../middleware/auth');
const { 
  getAuditLogs, 
  exportAuditLogs, 
  cleanupAuditLogs 
} = require('../utils/audit');
const { logger } = require('../utils/logger');
const { ValidationError, NotFoundError } = require('../utils/errors');

const router = express.Router();

// All audit routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/audit/logs:
 *   get:
 *     summary: Get audit logs with filtering and pagination
 *     tags: [Audit]
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
 *           default: 50
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *       - in: query
 *         name: resource
 *         schema:
 *           type: string
 *       - in: query
 *         name: riskLevel
 *         schema:
 *           type: string
 *           enum: [LOW, MEDIUM, HIGH, CRITICAL]
 *       - in: query
 *         name: flagged
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, action, riskLevel]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
 */
router.get('/logs',
  requirePermission('AUDIT_READ'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('userId').optional().isString(),
    query('action').optional().isString(),
    query('resource').optional().isString(),
    query('riskLevel').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
    query('flagged').optional().isBoolean(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('sortBy').optional().isIn(['createdAt', 'action', 'riskLevel']),
    query('sortOrder').optional().isIn(['asc', 'desc'])
  ],
  async (req, res, next) => {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const filters = {
        userId: req.query.userId,
        action: req.query.action,
        resource: req.query.resource,
        riskLevel: req.query.riskLevel,
        flagged: req.query.flagged,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      const pagination = {
        page: req.query.page || 1,
        limit: req.query.limit || 50,
        sortBy: req.query.sortBy || 'createdAt',
        sortOrder: req.query.sortOrder || 'desc'
      };

      // Non-admin users can only see their own audit logs
      if (req.user.role !== 'ADMIN' && req.user.role !== 'CHIEF_RADIOLOGIST') {
        filters.userId = req.user.id;
      }

      const result = await getAuditLogs(filters, pagination);

      res.json({
        success: true,
        data: result,
        filters: filters,
        pagination: result.pagination
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/audit/logs/{id}:
 *   get:
 *     summary: Get specific audit log by ID
 *     tags: [Audit]
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
 *         description: Audit log retrieved successfully
 *       404:
 *         description: Audit log not found
 */
router.get('/logs/:id',
  requirePermission('AUDIT_READ'),
  [param('id').isString().notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      const auditLog = await prisma.auditLog.findUnique({
        where: { id: req.params.id },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true
            }
          }
        }
      });

      if (!auditLog) {
        throw new NotFoundError('Audit log not found');
      }

      // Non-admin users can only see their own audit logs
      if (req.user.role !== 'ADMIN' && 
          req.user.role !== 'CHIEF_RADIOLOGIST' && 
          auditLog.userId !== req.user.id) {
        throw new NotFoundError('Audit log not found');
      }

      res.json({
        success: true,
        data: { auditLog }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/audit/summary:
 *   get:
 *     summary: Get audit log summary statistics
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d]
 *           default: 24h
 *     responses:
 *       200:
 *         description: Audit summary retrieved successfully
 */
router.get('/summary',
  requirePermission('AUDIT_READ'),
  [query('period').optional().isIn(['24h', '7d', '30d'])],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      const period = req.query.period || '24h';
      const periodHours = period === '24h' ? 24 : period === '7d' ? 168 : 720;
      const startDate = new Date(Date.now() - periodHours * 60 * 60 * 1000);

      const whereClause = {
        createdAt: { gte: startDate }
      };

      // Non-admin users can only see their own audit logs
      if (req.user.role !== 'ADMIN' && req.user.role !== 'CHIEF_RADIOLOGIST') {
        whereClause.userId = req.user.id;
      }

      const [
        totalLogs,
        logsByAction,
        logsByRiskLevel,
        logsByResource,
        flaggedLogs,
        reviewRequiredLogs,
        uniqueUsers
      ] = await Promise.all([
        prisma.auditLog.count({ where: whereClause }),
        prisma.auditLog.groupBy({
          by: ['action'],
          where: whereClause,
          _count: { action: true },
          orderBy: { _count: { action: 'desc' } },
          take: 10
        }),
        prisma.auditLog.groupBy({
          by: ['riskLevel'],
          where: whereClause,
          _count: { riskLevel: true }
        }),
        prisma.auditLog.groupBy({
          by: ['resource'],
          where: whereClause,
          _count: { resource: true },
          orderBy: { _count: { resource: 'desc' } },
          take: 10
        }),
        prisma.auditLog.count({
          where: { ...whereClause, flagged: true }
        }),
        prisma.auditLog.count({
          where: { ...whereClause, reviewRequired: true }
        }),
        prisma.auditLog.findMany({
          where: whereClause,
          select: { userId: true },
          distinct: ['userId']
        })
      ]);

      res.json({
        success: true,
        data: {
          period,
          summary: {
            totalLogs,
            flaggedLogs,
            reviewRequiredLogs,
            uniqueUsers: uniqueUsers.length
          },
          distribution: {
            byAction: logsByAction.map(item => ({
              action: item.action,
              count: item._count.action
            })),
            byRiskLevel: logsByRiskLevel.map(item => ({
              riskLevel: item.riskLevel,
              count: item._count.riskLevel
            })),
            byResource: logsByResource.map(item => ({
              resource: item.resource,
              count: item._count.resource
            }))
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
 * /api/v1/audit/export:
 *   get:
 *     summary: Export audit logs
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Audit logs exported successfully
 */
router.get('/export',
  requirePermission('AUDIT_READ'),
  [
    query('format').optional().isIn(['json', 'csv']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const format = req.query.format || 'json';
      const filters = {
        startDate: req.query.startDate,
        endDate: req.query.endDate
      };

      // Non-admin users can only export their own audit logs
      if (req.user.role !== 'ADMIN' && req.user.role !== 'CHIEF_RADIOLOGIST') {
        filters.userId = req.user.id;
      }

      const exportData = await exportAuditLogs(filters, format);

      // Set appropriate headers
      const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      
      if (format === 'csv') {
        res.set({
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`
        });
      } else {
        res.set({
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`
        });
      }

      res.send(exportData);

      // Log the export action
      logger.info('Audit logs exported', {
        userId: req.user.id,
        format,
        filters,
        exportSize: exportData.length
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/audit/cleanup:
 *   post:
 *     summary: Cleanup old audit logs
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cleanup completed successfully
 */
router.post('/cleanup',
  requirePermission('SYSTEM_ADMIN'),
  async (req, res, next) => {
    try {
      const deletedCount = await cleanupAuditLogs();

      logger.info('Audit logs cleanup initiated', {
        userId: req.user.id,
        deletedCount
      });

      res.json({
        success: true,
        message: 'Audit logs cleanup completed',
        data: {
          deletedCount,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/audit/flagged:
 *   get:
 *     summary: Get flagged audit logs requiring review
 *     tags: [Audit]
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
 *           default: 50
 *     responses:
 *       200:
 *         description: Flagged logs retrieved successfully
 */
router.get('/flagged',
  requirePermission('AUDIT_READ'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const filters = {
        flagged: true
      };

      const pagination = {
        page: req.query.page || 1,
        limit: req.query.limit || 50,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      };

      // Non-admin users can only see their own flagged logs
      if (req.user.role !== 'ADMIN' && req.user.role !== 'CHIEF_RADIOLOGIST') {
        filters.userId = req.user.id;
      }

      const result = await getAuditLogs(filters, pagination);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/v1/audit/review/{id}:
 *   post:
 *     summary: Mark audit log as reviewed
 *     tags: [Audit]
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
 *         description: Audit log marked as reviewed
 */
router.post('/review/:id',
  requirePermission('AUDIT_READ'),
  [param('id').isString().notEmpty()],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new ValidationError('Validation failed', errors.array());
      }

      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();

      const auditLog = await prisma.auditLog.findUnique({
        where: { id: req.params.id }
      });

      if (!auditLog) {
        throw new NotFoundError('Audit log not found');
      }

      // Only admins can review flagged logs
      if (req.user.role !== 'ADMIN' && req.user.role !== 'CHIEF_RADIOLOGIST') {
        throw new NotFoundError('Audit log not found');
      }

      const updatedLog = await prisma.auditLog.update({
        where: { id: req.params.id },
        data: {
          reviewRequired: false,
          reviewedBy: req.user.id,
          reviewedAt: new Date()
        }
      });

      logger.info('Audit log reviewed', {
        auditLogId: req.params.id,
        reviewedBy: req.user.id,
        originalAction: auditLog.action
      });

      res.json({
        success: true,
        message: 'Audit log marked as reviewed',
        data: { auditLog: updatedLog }
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;