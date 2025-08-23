/**
 * Start server without Redis - for development
 */

// Set environment to skip Redis
process.env.SKIP_REDIS = 'true';
process.env.NODE_ENV = 'development';

// Load the main server
require('./src/server.js');