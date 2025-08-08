const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { verifyToken } = require('../middleware/auth');
const { createAuditLog } = require('../utils/audit');
const { logger } = require('../utils/logger');
const config = require('../config/config');

const prisma = new PrismaClient();

/**
 * Setup WebSocket authentication middleware
 */
const setupWebSocketAuth = (io) => {
  // Global authentication middleware for all namespaces
  io.use(async (socket, next) => {
    try {
      await authenticateWebSocketConnection(socket);
      next();
    } catch (error) {
      logger.error('WebSocket authentication failed:', {
        error: error.message,
        socketId: socket.id,
        remoteAddress: socket.handshake.address
      });
      next(new Error('Authentication failed'));
    }
  });

  // Connection event for main namespace
  io.on('connection', (socket) => {
    logger.info(`WebSocket client connected to main namespace: ${socket.id}`, {
      userId: socket.userId,
      userRole: socket.userRole
    });

    // Handle authentication refresh
    socket.on('refresh_auth', async (data) => {
      try {
        await handleAuthRefresh(socket, data);
      } catch (error) {
        socket.emit('auth_error', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle heartbeat/ping
    socket.on('ping', () => {
      socket.emit('pong', {
        timestamp: new Date().toISOString(),
        userId: socket.userId
      });
    });

    socket.on('disconnect', (reason) => {
      handleWebSocketDisconnection(socket, reason);
    });
  });

  logger.info('WebSocket authentication middleware configured');
};

/**
 * Authenticate WebSocket connection
 */
const authenticateWebSocketConnection = async (socket) => {
  const token = extractTokenFromSocket(socket);
  
  if (!token) {
    throw new Error('Authentication token required');
  }

  try {
    // Verify JWT token
    const decoded = verifyToken(token);
    
    // Get user from database with permissions
    const user = await prisma.user.findUnique({
      where: { 
        id: decoded.userId,
        isActive: true
      },
      include: {
        permissions: {
          where: {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } }
            ]
          }
        },
        sessions: {
          where: {
            isActive: true,
            expiresAt: { gt: new Date() }
          },
          orderBy: {
            lastActivity: 'desc'
          },
          take: 1
        }
      }
    });

    if (!user) {
      throw new Error('User not found or inactive');
    }

    if (!user.isVerified) {
      throw new Error('User account not verified');
    }

    // Check if user has any valid session
    if (user.sessions.length === 0) {
      throw new Error('No valid session found');
    }

    // Attach user information to socket
    socket.userId = user.id;
    socket.userEmail = user.email;
    socket.userRole = user.role;
    socket.userDepartment = user.department;
    socket.userPermissions = user.permissions.map(p => ({
      permission: p.permission,
      resource: p.resource,
      conditions: p.conditions
    }));

    // Update session activity
    const session = user.sessions[0];
    await prisma.session.update({
      where: { id: session.id },
      data: { lastActivity: new Date() }
    });

    // Create audit log for WebSocket authentication
    await createAuditLog({
      userId: user.id,
      action: 'WEBSOCKET_AUTH_SUCCESS',
      resource: 'websocket',
      description: 'WebSocket authentication successful',
      ipAddress: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
      sessionId: session.sessionToken
    });

    logger.info('WebSocket authentication successful', {
      userId: user.id,
      email: user.email,
      role: user.role,
      socketId: socket.id,
      permissions: user.permissions.length
    });

  } catch (error) {
    // Create audit log for failed authentication
    await createAuditLog({
      action: 'WEBSOCKET_AUTH_FAILED',
      resource: 'websocket',
      description: `WebSocket authentication failed: ${error.message}`,
      ipAddress: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
      riskLevel: 'MEDIUM'
    });

    throw error;
  }
};

/**
 * Extract token from WebSocket connection
 */
const extractTokenFromSocket = (socket) => {
  // Try to get token from auth object (socket.io client sends it here)
  if (socket.handshake.auth && socket.handshake.auth.token) {
    return socket.handshake.auth.token;
  }

  // Try to get token from headers
  const authHeader = socket.handshake.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try to get token from query parameters (less secure, but sometimes necessary)
  if (socket.handshake.query && socket.handshake.query.token) {
    logger.warn('Token passed via query parameter - consider using headers or auth object', {
      socketId: socket.id,
      remoteAddress: socket.handshake.address
    });
    return socket.handshake.query.token;
  }

  return null;
};

/**
 * Handle authentication refresh
 */
const handleAuthRefresh = async (socket, data) => {
  const { refreshToken } = data;

  if (!refreshToken) {
    throw new Error('Refresh token required');
  }

  try {
    // Verify refresh token
    const decoded = verifyToken(refreshToken, config.jwt.refreshSecret);

    // Check refresh token in database
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!tokenRecord || tokenRecord.isRevoked) {
      throw new Error('Invalid refresh token');
    }

    if (tokenRecord.expiresAt < new Date()) {
      throw new Error('Refresh token expired');
    }

    if (tokenRecord.user.id !== socket.userId) {
      throw new Error('Token user mismatch');
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        userId: tokenRecord.user.id,
        role: tokenRecord.user.role,
        email: tokenRecord.user.email
      },
      config.jwt.secret,
      {
        expiresIn: config.jwt.expiresIn,
        issuer: config.jwt.issuer,
        audience: config.jwt.audience
      }
    );

    // Update token usage
    await prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { lastUsed: new Date() }
    });

    // Create audit log
    await createAuditLog({
      userId: socket.userId,
      action: 'WEBSOCKET_TOKEN_REFRESHED',
      resource: 'authentication',
      description: 'WebSocket authentication token refreshed',
      ipAddress: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent']
    });

    // Send new token to client
    socket.emit('auth_refreshed', {
      accessToken: newAccessToken,
      expiresIn: config.jwt.expiresIn,
      timestamp: new Date().toISOString()
    });

    logger.info('WebSocket authentication refreshed', {
      userId: socket.userId,
      socketId: socket.id
    });

  } catch (error) {
    logger.error('WebSocket auth refresh failed:', {
      error: error.message,
      userId: socket.userId,
      socketId: socket.id
    });

    await createAuditLog({
      userId: socket.userId,
      action: 'WEBSOCKET_TOKEN_REFRESH_FAILED',
      resource: 'authentication',
      description: `WebSocket token refresh failed: ${error.message}`,
      ipAddress: socket.handshake.address,
      userAgent: socket.handshake.headers['user-agent'],
      riskLevel: 'MEDIUM'
    });

    throw error;
  }
};

/**
 * Handle WebSocket disconnection
 */
const handleWebSocketDisconnection = async (socket, reason) => {
  try {
    logger.info(`WebSocket client disconnected: ${socket.id}`, {
      userId: socket.userId,
      userRole: socket.userRole,
      reason,
      duration: Date.now() - socket.handshake.time
    });

    // Create audit log for disconnection
    if (socket.userId) {
      await createAuditLog({
        userId: socket.userId,
        action: 'WEBSOCKET_DISCONNECTED',
        resource: 'websocket',
        description: `WebSocket disconnected: ${reason}`,
        ipAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      });
    }

  } catch (error) {
    logger.error('Error handling WebSocket disconnection:', error);
  }
};

/**
 * Check if socket has permission
 */
const checkSocketPermission = (socket, permission, resource = null) => {
  if (!socket.userPermissions) {
    return false;
  }

  return socket.userPermissions.some(p => {
    if (p.permission !== permission) {
      return false;
    }

    if (resource && p.resource && p.resource !== resource) {
      return false;
    }

    // TODO: Implement condition checking if needed
    return true;
  });
};

/**
 * Create authentication middleware for specific namespaces
 */
const createNamespaceAuth = (requiredPermissions = []) => {
  return async (socket, next) => {
    try {
      // Check if user is authenticated (should be done by global middleware)
      if (!socket.userId) {
        throw new Error('Socket not authenticated');
      }

      // Check permissions if specified
      if (requiredPermissions.length > 0) {
        const hasPermission = requiredPermissions.some(permission =>
          checkSocketPermission(socket, permission)
        );

        if (!hasPermission) {
          throw new Error(`Insufficient permissions. Required: ${requiredPermissions.join(', ')}`);
        }
      }

      next();

    } catch (error) {
      logger.error('Namespace authentication failed:', {
        error: error.message,
        userId: socket.userId,
        socketId: socket.id,
        requiredPermissions
      });

      await createAuditLog({
        userId: socket.userId,
        action: 'WEBSOCKET_NAMESPACE_ACCESS_DENIED',
        resource: 'websocket',
        description: `Namespace access denied: ${error.message}`,
        ipAddress: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent'],
        riskLevel: 'MEDIUM'
      });

      next(new Error('Authentication failed'));
    }
  };
};

/**
 * Rate limiting for WebSocket events
 */
const createSocketRateLimit = (maxEvents = 100, windowMs = 60000) => {
  const clientCounts = new Map();

  return (socket, eventName, callback) => {
    const clientId = socket.userId || socket.handshake.address;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create client record
    if (!clientCounts.has(clientId)) {
      clientCounts.set(clientId, []);
    }

    const events = clientCounts.get(clientId);
    
    // Remove old events outside the window
    const recentEvents = events.filter(timestamp => timestamp > windowStart);
    clientCounts.set(clientId, recentEvents);

    // Check rate limit
    if (recentEvents.length >= maxEvents) {
      logger.warn('WebSocket rate limit exceeded', {
        userId: socket.userId,
        socketId: socket.id,
        eventName,
        eventCount: recentEvents.length,
        windowMs
      });

      socket.emit('rate_limit_exceeded', {
        error: 'Rate limit exceeded',
        eventName,
        limit: maxEvents,
        window: windowMs,
        retryAfter: Math.ceil(windowMs / 1000),
        timestamp: new Date().toISOString()
      });

      return false;
    }

    // Add current event timestamp
    recentEvents.push(now);
    
    return true;
  };
};

/**
 * Middleware to attach rate limiter to socket
 */
const attachRateLimiter = (socket, maxEvents = 100, windowMs = 60000) => {
  const rateLimiter = createSocketRateLimit(maxEvents, windowMs);
  
  // Wrap socket.on to include rate limiting
  const originalOn = socket.on.bind(socket);
  socket.on = (eventName, callback) => {
    return originalOn(eventName, (...args) => {
      if (rateLimiter(socket, eventName)) {
        callback(...args);
      }
    });
  };
};

module.exports = {
  setupWebSocketAuth,
  authenticateWebSocketConnection,
  handleAuthRefresh,
  handleWebSocketDisconnection,
  checkSocketPermission,
  createNamespaceAuth,
  createSocketRateLimit,
  attachRateLimiter
};