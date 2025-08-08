# Medical Report Generation Service

A comprehensive FastAPI service for generating structured German medical reports from transcribed text using OpenAI GPT-4. This service is specifically designed for radiology departments and complies with German medical regulations, GDPR, and HIPAA requirements.

## 🏥 Features

### Core Functionality
- **AI-Powered Report Generation**: Convert transcribed medical dictation into structured German medical reports
- **Multi-Modal Examination Support**: MRI, CT, X-Ray, Ultrasound, and Mammography
- **German Medical Terminology**: Comprehensive validation and auto-correction
- **ICD-10-GM Code Suggestion**: Automatic suggestion of relevant ICD codes
- **Template-Based Reports**: Customizable templates following German medical standards

### Medical Compliance
- **GDPR Compliance**: Patient data anonymization and privacy protection
- **HIPAA Compliance**: Secure handling of medical information
- **German Medical Device Law (MPG)**: Compliance with German medical regulations
- **Audit Trail**: Complete tracking of all report modifications
- **Digital Signatures**: Support for physician digital signatures
- **Data Retention**: Automatic cleanup based on legal requirements (7 years)

### Technical Features
- **PostgreSQL Database**: Robust data storage with full-text search
- **Redis Caching**: High-performance caching and session management
- **Docker Containerization**: Easy deployment and scaling
- **Comprehensive API**: RESTful API with OpenAPI documentation
- **Error Handling**: Medical-grade error handling and logging
- **Health Monitoring**: Built-in health checks and metrics

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- OpenAI API key
- PostgreSQL 15+
- Redis 7+

### Environment Setup

1. **Clone and Navigate**
   ```bash
   cd /path/to/radiology-ai-system/services/report-generation
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   nano .env
   ```

3. **Start Services**
   ```bash
   docker-compose up -d
   ```

4. **Verify Installation**
   ```bash
   curl http://localhost:8002/health
   ```

### Development Setup

1. **Install Dependencies**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Database Setup**
   ```bash
   # Start PostgreSQL and Redis
   docker-compose up -d report-db redis
   
   # Run database initialization
   python -c "
   import asyncio
   from app.core.database import init_db
   asyncio.run(init_db())
   "
   ```

3. **Run Development Server**
   ```bash
   uvicorn main:app --reload --port 8002
   ```

## 📚 API Documentation

### Core Endpoints

#### Generate Report
```http
POST /api/v1/reports/generate
Content-Type: application/json

{
  "transcription": "MRT Kopf nativ. Klinische Fragestellung...",
  "examination_type": "MRI",
  "clinical_indication": "V.a. Raumforderung",
  "patient_id": "PAT_001",
  "examination_date": "2024-01-15T10:30:00Z",
  "dictating_physician_id": "DOC_001",
  "dictating_physician_name": "Dr. med. Müller"
}
```

#### Retrieve Report
```http
GET /api/v1/reports/{report_id}?include_html=true
```

#### Update Report
```http
PUT /api/v1/reports/{report_id}
Content-Type: application/json

{
  "findings": "Updated findings...",
  "assessment": "Updated assessment...",
  "change_reason": "Correction after review"
}
```

#### Finalize Report
```http
POST /api/v1/reports/{report_id}/finalize
Content-Type: application/json

{
  "reviewing_physician_id": "DOC_002",
  "reviewing_physician_name": "Prof. Dr. Schmidt",
  "digital_signature": "signature_data"
}
```

### Template Management

#### List Templates
```http
GET /api/v1/templates?examination_type=MRI&language=de
```

#### Get Default Template
```http
GET /api/v1/templates/examination-types/MRI/default
```

### Health Monitoring

#### Health Check
```http
GET /health
```

#### Detailed Health
```http
GET /health/ready
```

## 🏗️ Architecture

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FastAPI App   │────│  PostgreSQL DB  │────│   Redis Cache   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ├── OpenAI GPT-4 Integration
         ├── Medical Terminology Service
         ├── Report Generation Service
         ├── Compliance Service
         └── Template Management
```

### Database Schema

#### Core Tables
- **reports**: Main report data with versioning
- **report_templates**: Customizable report templates
- **medical_terms**: German medical terminology database
- **icd_codes**: ICD-10-GM codes with radiology relevance
- **radiology_findings**: Common radiological findings
- **quality_metrics**: Quality and performance tracking

### Services Architecture

#### Report Generation Flow
1. **Input Processing**: Validate and sanitize transcription
2. **AI Processing**: Generate structured content using OpenAI GPT-4
3. **Medical Validation**: Validate terminology and suggest ICD codes
4. **Quality Assessment**: Evaluate report quality and compliance
5. **Template Rendering**: Apply appropriate German medical template
6. **Audit Logging**: Record all operations for compliance

## 🔧 Configuration

### Environment Variables

#### Core Settings
```env
# Database
DATABASE_URL=postgresql://user:pass@host:port/db
DATABASE_POOL_SIZE=10

# Redis
REDIS_URL=redis://user:pass@host:port/db
REDIS_CACHE_TTL=3600

# OpenAI
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4-1106-preview
OPENAI_MAX_TOKENS=4000
OPENAI_TEMPERATURE=0.3

# Security
SECRET_KEY=your-256-bit-secret-key
REQUIRE_PHYSICIAN_SIGNATURE=true
ENABLE_AUDIT_LOGGING=true

# Medical Compliance
DATA_RETENTION_DAYS=2555  # 7 years
DEFAULT_LANGUAGE=de
```

### Docker Configuration

#### Production Deployment
```yaml
version: '3.8'
services:
  report-service:
    image: radiology/report-generation:latest
    environment:
      - DATABASE_URL=postgresql://...
      - OPENAI_API_KEY=sk-...
      - SECRET_KEY=...
    volumes:
      - ./logs:/app/logs
    ports:
      - "8002:8002"
```

## 🔒 Security & Compliance

### Data Protection
- **Patient Data Anonymization**: Automatic anonymization features
- **GDPR Compliance**: Right to be forgotten, data portability
- **Encryption**: All data encrypted at rest and in transit
- **Access Control**: Role-based access control for medical staff

### Medical Compliance
- **Audit Trails**: Complete history of all report modifications
- **Digital Signatures**: Support for physician electronic signatures
- **Quality Assurance**: Automated quality checks before finalization
- **Retention Policy**: Automatic cleanup after legal retention period

### Security Features
- **Rate Limiting**: Protection against API abuse
- **Input Validation**: Comprehensive input sanitization
- **Error Handling**: Secure error messages without information disclosure
- **Logging**: Comprehensive security and audit logging

## 🧪 Testing

### Unit Tests
```bash
pytest tests/unit/ -v
```

### Integration Tests
```bash
pytest tests/integration/ -v
```

### API Tests
```bash
# Test report generation
curl -X POST http://localhost:8002/api/v1/reports/generate \
  -H "Content-Type: application/json" \
  -d @tests/fixtures/sample_request.json

# Run full test suite
pytest tests/ --cov=app --cov-report=html
```

### Load Testing
```bash
# Install locust
pip install locust

# Run load tests
locust -f tests/load/locustfile.py --host=http://localhost:8002
```

## 📊 Monitoring & Metrics

### Health Endpoints
- `/health` - Basic health check
- `/health/ready` - Readiness check
- `/health/live` - Liveness check
- `/health/metrics` - Service metrics

### Logging
- **Application Logs**: `/app/logs/medical_report_service.log`
- **Error Logs**: `/app/logs/errors.log`
- **Audit Logs**: `/app/logs/medical_audit.log`
- **Security Logs**: `/app/logs/security.log`
- **Performance Logs**: `/app/logs/performance.log`

### Metrics Collection
```python
# Custom metrics example
from utils.logging_config import log_performance_metric

log_performance_metric(
    operation="report_generation",
    duration_ms=1250.5,
    success=True,
    details={"examination_type": "MRI"}
)
```

## 🔄 Deployment

### Production Deployment

1. **Build Images**
   ```bash
   docker build -t radiology/report-generation:v1.0.0 .
   ```

2. **Configure Secrets**
   ```bash
   # Use Docker secrets or external secret management
   echo "your-openai-key" | docker secret create openai_api_key -
   ```

3. **Deploy Stack**
   ```bash
   docker stack deploy -c docker-compose.prod.yml radiology-reports
   ```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: report-generation-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: report-generation
  template:
    metadata:
      labels:
        app: report-generation
    spec:
      containers:
      - name: report-service
        image: radiology/report-generation:v1.0.0
        ports:
        - containerPort: 8002
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: openai-secret
              key: api-key
```

### High Availability Setup
- **Load Balancer**: Nginx with health checks
- **Database Clustering**: PostgreSQL with read replicas
- **Redis Clustering**: Redis Cluster for high availability
- **Monitoring**: Prometheus + Grafana stack

## 🛠️ Development

### Project Structure
```
├── app/
│   ├── api/routes/          # API endpoint definitions
│   ├── core/                # Core configuration and database
│   ├── models/              # SQLAlchemy database models
│   ├── schemas/             # Pydantic request/response schemas
│   └── services/            # Business logic services
├── templates/               # German medical report templates
├── utils/                   # Utility functions and helpers
├── tests/                   # Test suite
├── database/                # Database initialization scripts
├── logs/                    # Application logs
└── docker-compose.yml       # Development environment
```

### Code Quality
```bash
# Format code
black app/ tests/

# Lint code
flake8 app/ tests/

# Type checking
mypy app/

# Security scan
bandit -r app/
```

### Database Migrations
```bash
# Generate migration
alembic revision --autogenerate -m "Add new feature"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## 📖 Medical Templates

### German Report Structure
The service uses authentic German medical report templates based on the "Radiologische Allianz" structure:

```
┌─────────────────────────────────────┐
│        RADIOLOGISCHER BEFUND        │
│     Radiologische Allianz Logo     │
├─────────────────────────────────────┤
│ Patient: [Anonymized]               │
│ Untersuchungsdatum: 15.01.2024     │
│ Untersuchungsart: MRT Kopf         │
├─────────────────────────────────────┤
│ KLINISCHE FRAGESTELLUNG:            │
│ V.a. Raumforderung, Abklärung      │
├─────────────────────────────────────┤
│ TECHNISCHE DURCHFÜHRUNG:            │
│ • Gerät: 1,5 Tesla MRT             │
│ • Sequenzen: T1, T2, FLAIR, DWI    │
├─────────────────────────────────────┤
│ BEFUND:                             │
│ [Detailed German medical findings]  │
├─────────────────────────────────────┤
│ BEURTEILUNG:                        │
│ [Medical assessment in German]      │
├─────────────────────────────────────┤
│ EMPFEHLUNGEN:                       │
│ [Recommendations if applicable]     │
├─────────────────────────────────────┤
│ Diktiert: Dr. med. Müller          │
│ Befundet: Prof. Dr. Schmidt        │
│ [Digital Signatures]                │
└─────────────────────────────────────┘
```

## 🤝 Contributing

### Getting Started
1. Fork the repository
2. Create a feature branch (`feature/new-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Standards
- Follow PEP 8 style guide
- Add type hints to all functions
- Write comprehensive docstrings
- Include unit tests for new features
- Update documentation for API changes

### Medical Data Handling
- Never commit real patient data
- Use only anonymized test data
- Follow GDPR guidelines in development
- Respect medical data sensitivity

## 📄 License

This project is licensed under a proprietary medical software license. Unauthorized use, reproduction, or distribution is strictly prohibited.

## 🆘 Support

### Documentation
- **API Docs**: http://localhost:8002/docs
- **ReDoc**: http://localhost:8002/redoc
- **Health Check**: http://localhost:8002/health

### Troubleshooting

#### Common Issues

**OpenAI API Errors**
```bash
# Check API key
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
     https://api.openai.com/v1/models
```

**Database Connection Issues**
```bash
# Test database connection
docker-compose exec report-db psql -U postgres -d radiology_reports -c "SELECT version();"
```

**Memory Issues**
```bash
# Monitor memory usage
docker stats report-service
```

### Getting Help
- Check the troubleshooting guide above
- Review application logs in `/app/logs/`
- Check service health at `/health`
- Contact medical IT support for production issues

## 🔮 Roadmap

### Version 2.0 (Planned Features)
- **Multi-language Support**: English report templates
- **DICOM Integration**: Direct integration with PACS systems
- **Voice Recognition**: Real-time transcription from audio
- **AI Model Fine-tuning**: Custom medical AI models
- **Mobile App**: Companion mobile application
- **Advanced Analytics**: Reporting and analytics dashboard

### Version 2.1 (Future)
- **Machine Learning Pipeline**: Automated quality improvement
- **Integration APIs**: EMR/HIS system integrations
- **Blockchain Audit**: Immutable audit trail using blockchain
- **Advanced Security**: Zero-trust security model

---

**Medical Report Generation Service v1.0.0**  
*Developed for professional medical use - Handle with care* 🏥