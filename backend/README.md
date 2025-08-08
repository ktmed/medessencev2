# Radiology AI Gateway

A medical-grade API Gateway for the Radiology AI System, providing secure authentication, authorization, and service orchestration for medical professionals.

## 🏥 Overview

The Radiology AI Gateway serves as the central entry point for all client applications, providing:

- **Authentication & Authorization**: JWT-based authentication with role-based access control for German medical professionals
- **Service Orchestration**: Proxy and load balancing for transcription, report generation, and summary services
- **Medical Compliance**: GDPR-compliant audit logging and data handling
- **Real-time Features**: WebSocket support for live transcription and progress updates
- **Monitoring & Metrics**: Comprehensive health checks and Prometheus metrics
- **Security**: Rate limiting, input validation, and medical-grade security controls

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (recommended)

### Using Docker Compose (Recommended)

1. **Clone and setup**:
```bash
git clone <repository-url>
cd radiology-ai-system/backend
cp .env.example .env
```

2. **Configure environment variables**:
```bash
# Edit .env file with your settings
nano .env
```

3. **Start all services**:
```bash
# Start with mock services for development
docker-compose --profile mock up -d

# Or start without mock services (requires actual microservices)
docker-compose up -d
```

4. **Initialize database**:
```bash
# Run migrations and seed data
docker-compose exec gateway npm run db:migrate
docker-compose exec gateway npm run db:seed
```

5. **Access the application**:
- API Gateway: http://localhost:3000
- API Documentation: http://localhost:3000/docs
- Health Check: http://localhost:3000/health
- Metrics: http://localhost:9090 (Prometheus)
- Monitoring: http://localhost:3001 (Grafana)

### Manual Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Setup database**:
```bash
# Configure PostgreSQL and Redis
# Update DATABASE_URL and REDIS_URL in .env

# Run Prisma migrations
npm run db:migrate
npm run db:seed
```

3. **Start development server**:
```bash
npm run dev
```

## 🔐 Default Users

After seeding, the following test accounts are available:

| Role | Email | Password | Permissions |
|------|--------|----------|-------------|
| Admin | admin@radiology-ai.com | Admin123!@# | Full system access |
| Chief Radiologist | chief@radiology-ai.com | Chief123!@# | Department management |
| Senior Radiologist | senior@radiology-ai.com | Senior123!@# | Report approval & signing |
| Radiologist | radiologist@radiology-ai.com | Radio123!@# | Standard medical access |
| Resident | resident@radiology-ai.com | Resident123!@# | Limited access |
| Technician | technician@radiology-ai.com | Tech123!@# | Technical operations |

**⚠️ Change these passwords immediately in production!**

## 📋 API Documentation

### Authentication

All API endpoints require authentication except:
- `GET /health` - Health check
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration

#### Login Example

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "radiologist@radiology-ai.com",
    "password": "Radio123!@#"
  }'
```

#### Using Bearer Token

```bash
curl -X GET http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer <your-jwt-token>"
```

### Main Endpoints

| Method | Endpoint | Description | Required Permission |
|--------|----------|-------------|-------------------|
| POST | `/api/v1/auth/login` | User login | - |
| POST | `/api/v1/auth/logout` | User logout | Authenticated |
| GET | `/api/v1/auth/me` | Current user info | Authenticated |
| GET | `/api/v1/users` | List users | USER_READ |
| POST | `/api/v1/users` | Create user | USER_CREATE |
| GET | `/api/v1/health` | System health | - |
| GET | `/api/v1/metrics` | Prometheus metrics | METRICS_READ |
| GET | `/api/v1/audit/logs` | Audit logs | AUDIT_READ |

### Service Proxy Endpoints

The gateway proxies requests to microservices:

- `/api/v1/transcription/*` → Transcription Service
- `/api/v1/reports/*` → Report Generation Service  
- `/api/v1/summaries/*` → Summary Generation Service

### WebSocket Endpoints

Real-time features are available via WebSocket:

- `/transcription` - Live transcription updates
- `/reports` - Report generation progress
- `/summaries` - Summary generation status
- `/updates` - General system notifications

#### WebSocket Connection Example

```javascript
const socket = io('http://localhost:3000/transcription', {
  auth: {
    token: 'your-jwt-token'
  }
});

socket.on('transcription_progress', (data) => {
  console.log('Transcription update:', data);
});
```

## 🏗️ Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │ Microservices   │
│   Application   │◄──►│   (This App)    │◄──►│   - Transcription│
│                 │    │                 │    │   - Reports      │
└─────────────────┘    └─────────────────┘    │   - Summaries    │
                                              └─────────────────┘
                                ▲
                                │
                       ┌─────────────────┐
                       │   Persistence   │
                       │   - PostgreSQL  │
                       │   - Redis       │
                       └─────────────────┘
```

### Key Features

- **Circuit Breakers**: Prevent cascade failures with configurable circuit breakers
- **Rate Limiting**: Protect against abuse with Redis-backed rate limiting
- **Audit Logging**: GDPR-compliant audit trails for all medical data access
- **Health Monitoring**: Comprehensive health checks for all system components
- **Metrics Collection**: Prometheus metrics for monitoring and alerting

## 🔧 Configuration

### Environment Variables

Key configuration options:

```bash
# Application
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/radiology_ai

# Redis
REDIS_URL=redis://localhost:6379

# JWT Authentication
JWT_SECRET=your-256-bit-secret
JWT_REFRESH_SECRET=your-256-bit-refresh-secret
JWT_EXPIRE_TIME=15m
JWT_REFRESH_EXPIRE_TIME=7d

# Microservices
TRANSCRIPTION_SERVICE_URL=http://localhost:8001
REPORT_GENERATION_SERVICE_URL=http://localhost:8002
SUMMARY_GENERATION_SERVICE_URL=http://localhost:8003

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
BCRYPT_SALT_ROUNDS=12

# Medical Compliance
GDPR_COMPLIANCE=true
AUDIT_LOG_ENABLED=true
DATA_RETENTION_DAYS=3650
```

### Database Schema

The system uses Prisma ORM with PostgreSQL:

- **Users**: Medical professional accounts with role-based access
- **Sessions**: Active user sessions with device tracking
- **Permissions**: Granular permission system for medical operations
- **Audit Logs**: Comprehensive audit trail for GDPR compliance
- **Service Health**: Monitoring data for all system components

## 🔒 Security

### Authentication & Authorization

- **JWT Tokens**: Secure authentication with refresh tokens
- **Role-Based Access**: German medical hierarchy (Admin, Chief, Senior, Radiologist, Resident, Technician)
- **Permission System**: Granular permissions for medical operations
- **Session Management**: Device tracking and session monitoring

### Medical Compliance

- **GDPR Compliance**: Full audit trails and data protection
- **Data Encryption**: All sensitive data encrypted at rest and in transit
- **Audit Logging**: Every action logged with risk assessment
- **Data Retention**: Configurable retention policies for medical data
- **Access Controls**: Strict access controls based on medical roles

### Security Features

- **Rate Limiting**: Protect against brute force and DoS attacks
- **Input Validation**: Comprehensive input sanitization
- **CORS Protection**: Configurable cross-origin resource sharing
- **Security Headers**: Standard security headers for all responses
- **Circuit Breakers**: Prevent cascade failures and improve resilience

## 📊 Monitoring

### Health Checks

Multiple health check endpoints:

- `GET /health` - Basic health status
- `GET /health/detailed` - Detailed system health
- `GET /health/live` - Kubernetes liveness probe
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/services` - Microservices health

### Metrics

Prometheus metrics available at `/api/v1/metrics`:

- HTTP request metrics (count, duration, status codes)
- Authentication metrics (attempts, successes, failures)
- Service proxy metrics (requests, circuit breaker states)
- System metrics (memory, CPU, database connections)
- Medical data access metrics (GDPR compliance)

### Logging

Structured logging with multiple levels:

- **Application Logs**: General application events
- **Security Logs**: Authentication and authorization events
- **Audit Logs**: Medical data access (GDPR compliant)
- **Performance Logs**: Response times and performance metrics
- **Error Logs**: Application errors and exceptions

## 🚀 Deployment

### Docker Deployment

1. **Build production image**:
```bash
docker build -t radiology-ai-gateway .
```

2. **Run with environment**:
```bash
docker run -d \
  --name radiology-gateway \
  -p 3000:3000 \
  --env-file .env.production \
  radiology-ai-gateway
```

### Kubernetes Deployment

Example Kubernetes manifests available in `/k8s` directory:

```bash
kubectl apply -f k8s/
```

### Production Considerations

- **SSL/TLS**: Always use HTTPS in production
- **Database Security**: Use connection pooling and read replicas
- **Secrets Management**: Use Kubernetes secrets or HashiCorp Vault
- **Monitoring**: Set up Prometheus and Grafana for monitoring
- **Backup**: Regular database backups with point-in-time recovery
- **Scaling**: Use horizontal pod autoscaling for high availability

## 🧪 Testing

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage
```

### API Testing

Use the provided Postman collection or test with curl:

```bash
# Health check
curl http://localhost:3000/health

# Login test
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'
```

## 📚 Development

### Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   ├── database/         # Database connection and utilities
│   ├── docs/             # API documentation
│   ├── middleware/       # Express middleware
│   ├── redis/            # Redis connection and utilities
│   ├── routes/           # API route handlers
│   ├── utils/            # Utility functions
│   ├── websocket/        # WebSocket handlers
│   └── server.js         # Main application entry point
├── prisma/               # Database schema and migrations
│   ├── schema.prisma     # Prisma schema definition
│   └── seed.js           # Database seed script
├── logs/                 # Application logs
├── docker-compose.yml    # Docker Compose configuration
├── Dockerfile            # Docker image definition
└── package.json          # Dependencies and scripts
```

### Adding New Features

1. **Create Migration**: Add database changes to Prisma schema
2. **Update Permissions**: Add new permissions if needed
3. **Add Routes**: Create new route handlers with authentication
4. **Add Tests**: Write unit and integration tests
5. **Update Documentation**: Update API documentation and README

### Code Standards

- **ESLint**: Follow JavaScript best practices
- **Prettier**: Consistent code formatting
- **JSDoc**: Document all functions and classes
- **Error Handling**: Use structured error handling
- **Logging**: Add appropriate logging for debugging

## 🆘 Troubleshooting

### Common Issues

1. **Database Connection Failed**:
   - Check PostgreSQL is running
   - Verify DATABASE_URL is correct
   - Ensure database exists and user has permissions

2. **Redis Connection Failed**:
   - Check Redis is running
   - Verify REDIS_URL is correct
   - Check network connectivity

3. **JWT Token Invalid**:
   - Verify JWT_SECRET is set and consistent
   - Check token expiration
   - Ensure proper Bearer token format

4. **Permission Denied**:
   - Check user has required permissions
   - Verify role-based access is configured
   - Check audit logs for access attempts

5. **Service Unavailable**:
   - Check microservice health
   - Verify service URLs are correct
   - Check circuit breaker status

### Debugging

Enable debug logging:

```bash
LOG_LEVEL=debug npm run dev
```

Check service health:

```bash
curl http://localhost:3000/health/detailed
```

View audit logs:

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/v1/audit/logs
```

## 📞 Support

For support and questions:

- **Documentation**: `/docs` endpoint for API documentation
- **Health Status**: `/health` endpoint for system status
- **Logs**: Check application logs in `/logs` directory
- **Metrics**: Monitor system metrics at `/api/v1/metrics`

## 📝 License

This project is proprietary software. All rights reserved.

## 🤝 Contributing

This is a proprietary medical system. Contact the development team for contribution guidelines.

---

**⚠️ Medical Device Warning**: This software is designed for use by qualified medical professionals only. Ensure compliance with local medical device regulations and data protection laws.