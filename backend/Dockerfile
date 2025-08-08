# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install OpenSSL for Prisma compatibility
RUN apk add --no-cache openssl openssl-dev libc6-compat

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma/schema.prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Generate Prisma client
RUN npx prisma generate

# Development stage
FROM base AS development

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Development command
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS builder

# Install all dependencies for building
RUN npm ci

# Copy source code
COPY . .

# Build application (if you have a build step)
# RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install OpenSSL for Prisma compatibility
RUN apk add --no-cache openssl openssl-dev libc6-compat

# Set NODE_ENV to production
ENV NODE_ENV=production

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S gateway -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=gateway:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=gateway:nodejs /app/package*.json ./
COPY --from=builder --chown=gateway:nodejs /app/prisma ./prisma
COPY --from=builder --chown=gateway:nodejs /app/src ./src

# Create logs directory
RUN mkdir -p logs && chown gateway:nodejs logs

# Install production tools
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Switch to non-root user
USER gateway

# Generate Prisma client
RUN npx prisma generate

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "src/server.js"]

# Labels for metadata
LABEL maintainer="Medical AI Team <team@radiology-ai.com>"
LABEL version="1.0.0"
LABEL description="Radiology AI Gateway - Medical-grade API Gateway"
LABEL org.opencontainers.image.title="Radiology AI Gateway"
LABEL org.opencontainers.image.description="Medical-grade API Gateway for Radiology AI System"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.vendor="Medical AI Team"
LABEL org.opencontainers.image.licenses="PROPRIETARY"