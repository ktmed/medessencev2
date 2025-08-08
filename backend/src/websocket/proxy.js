const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { getRedis, getPublisher, getSubscriber } = require('../redis/connection');
const { verifyToken } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { logger, logMedicalAccess } = require('../utils/logger');
const config = require('../config/config');

/**
 * Setup WebSocket proxy for real-time features
 */
const setupWebSocketProxy = (io) => {
  // Setup Redis adapter for scaling across multiple instances
  try {
    const pubClient = getPublisher();
    const subClient = getSubscriber();
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('WebSocket Redis adapter configured');
  } catch (error) {
    logger.warn('WebSocket Redis adapter not configured:', error.message);
  }

  // Namespace for transcription service
  const transcriptionNamespace = io.of('/transcription');
  setupTranscriptionProxy(transcriptionNamespace);

  // Namespace for report generation
  const reportNamespace = io.of('/reports');
  setupReportProxy(reportNamespace);

  // Namespace for summary generation
  const summaryNamespace = io.of('/summaries');
  setupSummaryProxy(summaryNamespace);

  // General real-time updates namespace
  const updatesNamespace = io.of('/updates');
  setupUpdatesProxy(updatesNamespace);

  logger.info('WebSocket proxy configured for all services');
};

/**
 * Setup transcription service WebSocket proxy
 */
const setupTranscriptionProxy = (namespace) => {
  namespace.use(async (socket, next) => {
    try {
      await authenticateSocket(socket);
      
      // Check transcription permissions
      const hasPermission = socket.user.permissions.some(p => 
        ['TRANSCRIPTION_READ', 'TRANSCRIPTION_CREATE'].includes(p.permission)
      );

      if (!hasPermission) {
        throw new Error('Insufficient permissions for transcription service');
      }

      next();
    } catch (error) {
      logger.error('Transcription WebSocket authentication failed:', error);
      next(new Error('Authentication failed'));
    }
  });

  namespace.on('connection', (socket) => {
    logger.info(`Transcription WebSocket client connected: ${socket.id}`, {
      userId: socket.user.id,
      userRole: socket.user.role
    });

    // Join user-specific room
    socket.join(`user:${socket.user.id}`);
    
    // Join department room if applicable
    if (socket.user.department) {
      socket.join(`department:${socket.user.department}`);
    }

    // Handle transcription start
    socket.on('start_transcription', async (data) => {
      try {
        await handleTranscriptionStart(socket, data);
      } catch (error) {
        socket.emit('transcription_error', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle transcription stop
    socket.on('stop_transcription', async (data) => {
      try {
        await handleTranscriptionStop(socket, data);
      } catch (error) {
        socket.emit('transcription_error', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle audio data streaming
    socket.on('audio_data', async (data) => {
      try {
        await handleAudioData(socket, data);
      } catch (error) {
        socket.emit('transcription_error', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    socket.on('disconnect', async (reason) => {
      logger.info(`Transcription WebSocket client disconnected: ${socket.id}`, {
        userId: socket.user.id,
        reason
      });

      // Cleanup any ongoing transcriptions
      await cleanupTranscriptionSession(socket);
    });
  });
};

/**
 * Setup report generation WebSocket proxy
 */
const setupReportProxy = (namespace) => {
  namespace.use(async (socket, next) => {
    try {
      await authenticateSocket(socket);
      
      // Check report permissions
      const hasPermission = socket.user.permissions.some(p => 
        ['REPORT_READ', 'REPORT_CREATE'].includes(p.permission)
      );

      if (!hasPermission) {
        throw new Error('Insufficient permissions for report service');
      }

      next();
    } catch (error) {
      logger.error('Report WebSocket authentication failed:', error);
      next(new Error('Authentication failed'));
    }
  });

  namespace.on('connection', (socket) => {
    logger.info(`Report WebSocket client connected: ${socket.id}`, {
      userId: socket.user.id,
      userRole: socket.user.role
    });

    socket.join(`user:${socket.user.id}`);

    // Handle report generation request
    socket.on('generate_report', async (data) => {
      try {
        await handleReportGeneration(socket, data);
      } catch (error) {
        socket.emit('report_error', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle report status check
    socket.on('check_report_status', async (data) => {
      try {
        await handleReportStatusCheck(socket, data);
      } catch (error) {
        socket.emit('report_error', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Report WebSocket client disconnected: ${socket.id}`, {
        userId: socket.user.id,
        reason
      });
    });
  });
};

/**
 * Setup summary generation WebSocket proxy
 */
const setupSummaryProxy = (namespace) => {
  namespace.use(async (socket, next) => {
    try {
      await authenticateSocket(socket);
      
      // Check summary permissions
      const hasPermission = socket.user.permissions.some(p => 
        ['SUMMARY_READ', 'SUMMARY_CREATE'].includes(p.permission)
      );

      if (!hasPermission) {
        throw new Error('Insufficient permissions for summary service');
      }

      next();
    } catch (error) {
      logger.error('Summary WebSocket authentication failed:', error);
      next(new Error('Authentication failed'));
    }
  });

  namespace.on('connection', (socket) => {
    logger.info(`Summary WebSocket client connected: ${socket.id}`, {
      userId: socket.user.id,
      userRole: socket.user.role
    });

    socket.join(`user:${socket.user.id}`);

    // Handle summary generation request
    socket.on('generate_summary', async (data) => {
      try {
        await handleSummaryGeneration(socket, data);
      } catch (error) {
        socket.emit('summary_error', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Summary WebSocket client disconnected: ${socket.id}`, {
        userId: socket.user.id,
        reason
      });
    });
  });
};

/**
 * Setup general updates WebSocket proxy
 */
const setupUpdatesProxy = (namespace) => {
  namespace.use(async (socket, next) => {
    try {
      await authenticateSocket(socket);
      next();
    } catch (error) {
      logger.error('Updates WebSocket authentication failed:', error);
      next(new Error('Authentication failed'));
    }
  });

  namespace.on('connection', (socket) => {
    logger.info(`Updates WebSocket client connected: ${socket.id}`, {
      userId: socket.user.id,
      userRole: socket.user.role
    });

    // Join user-specific room for notifications
    socket.join(`user:${socket.user.id}`);
    
    // Join role-based rooms
    socket.join(`role:${socket.user.role}`);
    
    // Join department room
    if (socket.user.department) {
      socket.join(`department:${socket.user.department}`);
    }

    // Send initial connection confirmation
    socket.emit('connected', {
      userId: socket.user.id,
      timestamp: new Date().toISOString(),
      rooms: [`user:${socket.user.id}`, `role:${socket.user.role}`]
    });

    socket.on('disconnect', (reason) => {
      logger.info(`Updates WebSocket client disconnected: ${socket.id}`, {
        userId: socket.user.id,
        reason
      });
    });
  });
};

/**
 * Authenticate WebSocket connection
 */
const authenticateSocket = async (socket) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    throw new Error('Authentication token required');
  }

  try {
    const decoded = verifyToken(token);
    
    // Get user from database (you might want to cache this)
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        permissions: true
      }
    });

    if (!user || !user.isActive) {
      throw new Error('Invalid user or inactive account');
    }

    // Attach user to socket
    socket.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      department: user.department,
      permissions: user.permissions.map(p => ({
        permission: p.permission,
        resource: p.resource
      }))
    };

    // Create audit log for WebSocket connection
    await createAuditLog({
      userId: user.id,
      action: 'WEBSOCKET_CONNECTED',
      resource: 'websocket',
      description: `WebSocket connection established`,
      ipAddress: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent']
    });

  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
};

/**
 * Handle transcription start
 */
const handleTranscriptionStart = async (socket, data) => {
  const { sessionId, language = 'de', sampleRate = 16000 } = data;

  // Create audit log
  await createAuditLog({
    userId: socket.user.id,
    action: 'TRANSCRIPTION_STARTED',
    resource: 'transcription',
    resourceId: sessionId,
    description: `Started transcription session: ${sessionId}`,
    ipAddress: socket.handshake.address,
    medicalDataType: 'transcription'
  });

  // Log medical data access
  logMedicalAccess('TRANSCRIPTION_STARTED', {
    userId: socket.user.id,
    sessionId,
    language,
    sampleRate
  });

  // Forward to transcription service (if it has WebSocket support)
  // For now, emit confirmation
  socket.emit('transcription_started', {
    sessionId,
    status: 'active',
    timestamp: new Date().toISOString()
  });

  logger.info('Transcription session started', {
    userId: socket.user.id,
    sessionId,
    language,
    sampleRate
  });
};

/**
 * Handle transcription stop
 */
const handleTranscriptionStop = async (socket, data) => {
  const { sessionId } = data;

  // Create audit log
  await createAuditLog({
    userId: socket.user.id,
    action: 'TRANSCRIPTION_STOPPED',
    resource: 'transcription',
    resourceId: sessionId,
    description: `Stopped transcription session: ${sessionId}`,
    ipAddress: socket.handshake.address,
    medicalDataType: 'transcription'
  });

  socket.emit('transcription_stopped', {
    sessionId,
    status: 'completed',
    timestamp: new Date().toISOString()
  });

  logger.info('Transcription session stopped', {
    userId: socket.user.id,
    sessionId
  });
};

/**
 * Handle audio data streaming
 */
const handleAudioData = async (socket, data) => {
  const { sessionId, audioChunk, timestamp } = data;

  // Here you would forward the audio data to the transcription service
  // For now, just acknowledge receipt
  socket.emit('audio_received', {
    sessionId,
    timestamp: new Date().toISOString(),
    chunkSize: audioChunk ? audioChunk.length : 0
  });

  // Log high-frequency data access (you might want to batch these)
  if (Math.random() < 0.01) { // Log only 1% to avoid spam
    logMedicalAccess('AUDIO_DATA_PROCESSED', {
      userId: socket.user.id,
      sessionId,
      chunkSize: audioChunk ? audioChunk.length : 0
    });
  }
};

/**
 * Handle report generation
 */
const handleReportGeneration = async (socket, data) => {
  const { reportId, transcriptionId, template, language = 'de' } = data;

  // Create audit log
  await createAuditLog({
    userId: socket.user.id,
    action: 'REPORT_GENERATION_STARTED',
    resource: 'report',
    resourceId: reportId,
    description: `Started report generation: ${reportId}`,
    ipAddress: socket.handshake.address,
    medicalDataType: 'report'
  });

  // Emit progress updates
  socket.emit('report_progress', {
    reportId,
    status: 'processing',
    progress: 0,
    timestamp: new Date().toISOString()
  });

  // Simulate progress (in real implementation, this would come from the service)
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += Math.random() * 20;
    if (progress >= 100) {
      progress = 100;
      clearInterval(progressInterval);
      
      socket.emit('report_completed', {
        reportId,
        status: 'completed',
        downloadUrl: `/api/v1/reports/${reportId}/download`,
        timestamp: new Date().toISOString()
      });
    } else {
      socket.emit('report_progress', {
        reportId,
        status: 'processing',
        progress: Math.round(progress),
        timestamp: new Date().toISOString()
      });
    }
  }, 1000);

  logger.info('Report generation started', {
    userId: socket.user.id,
    reportId,
    transcriptionId,
    template
  });
};

/**
 * Handle report status check
 */
const handleReportStatusCheck = async (socket, data) => {
  const { reportId } = data;

  // In real implementation, check with report service
  socket.emit('report_status', {
    reportId,
    status: 'processing',
    progress: Math.floor(Math.random() * 100),
    timestamp: new Date().toISOString()
  });
};

/**
 * Handle summary generation
 */
const handleSummaryGeneration = async (socket, data) => {
  const { summaryId, reportId, complexity = 'medium', language = 'de' } = data;

  // Create audit log
  await createAuditLog({
    userId: socket.user.id,
    action: 'SUMMARY_GENERATION_STARTED',
    resource: 'summary',
    resourceId: summaryId,
    description: `Started summary generation: ${summaryId}`,
    ipAddress: socket.handshake.address,
    medicalDataType: 'summary'
  });

  // Emit progress
  socket.emit('summary_progress', {
    summaryId,
    status: 'processing',
    timestamp: new Date().toISOString()
  });

  // Simulate completion (replace with actual service call)
  setTimeout(() => {
    socket.emit('summary_completed', {
      summaryId,
      status: 'completed',
      downloadUrl: `/api/v1/summaries/${summaryId}/download`,
      timestamp: new Date().toISOString()
    });
  }, 3000);

  logger.info('Summary generation started', {
    userId: socket.user.id,
    summaryId,
    reportId,
    complexity
  });
};

/**
 * Cleanup transcription session
 */
const cleanupTranscriptionSession = async (socket) => {
  // In real implementation, cleanup any ongoing transcription sessions
  logger.info('Cleaning up transcription session', {
    userId: socket.user?.id,
    socketId: socket.id
  });
};

/**
 * Emit real-time updates to specific users or groups
 */
const emitToUser = (io, userId, event, data) => {
  io.of('/updates').to(`user:${userId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

const emitToRole = (io, role, event, data) => {
  io.of('/updates').to(`role:${role}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

const emitToDepartment = (io, department, event, data) => {
  io.of('/updates').to(`department:${department}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  setupWebSocketProxy,
  emitToUser,
  emitToRole,
  emitToDepartment
};