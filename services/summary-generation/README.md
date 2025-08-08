# Patient-Friendly Summary Generation Service

A comprehensive FastAPI service that converts complex German medical reports into patient-friendly summaries in multiple languages, with cultural adaptations and medical safety features.

## 🌟 Features

### Core Functionality
- **Multi-language Support**: German, English, French, Spanish, Italian, Turkish
- **Complexity Levels**: Basic, Intermediate, Advanced explanations
- **AI-Powered Generation**: OpenAI GPT-4 integration with medical prompts
- **Medical Terminology**: Comprehensive dictionaries and simplification
- **Emergency Detection**: Automatic identification of urgent conditions
- **Cultural Adaptation**: Region-specific medical communication styles

### Medical Safety & Compliance
- **Patient Safety Disclaimers**: Culturally appropriate medical disclaimers
- **Emergency Indicators**: Automatic detection and warnings for critical conditions
- **Medical Term Glossary**: Patient-friendly explanations of medical terminology
- **Quality Assurance**: Confidence scoring and validation

### Technical Features
- **Async FastAPI**: High-performance async web framework
- **PostgreSQL Database**: Robust data storage with async support
- **Redis Caching**: Performance optimization
- **Docker Support**: Complete containerization
- **Comprehensive Logging**: Structured logging with JSON support
- **Health Monitoring**: Health checks and metrics

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+
- OpenAI API Key

### Installation

1. **Clone and Setup**
```bash
cd services/summary-generation
cp .env.example .env
# Edit .env with your configuration
```

2. **Using Docker Compose (Recommended)**
```bash
docker-compose up -d
```

3. **Manual Installation**
```bash
pip install -r requirements.txt
./start.sh
```

### Configuration

Edit `.env` file with your settings:

```env
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Database
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/radiology_ai

# Application
DEBUG=false
LOG_LEVEL=INFO
```

## 📚 API Documentation

### Core Endpoints

#### Generate Summary
```http
POST /generate-summary
```

Generate a patient-friendly summary from a medical report.

**Request Body:**
```json
{
  "report_text": "German medical report text...",
  "language": "en",
  "complexity_level": "basic",
  "cultural_context": "formal",
  "region": "US",
  "include_glossary": true,
  "emergency_detection": true
}
```

**Response:**
```json
{
  "id": "uuid",
  "content": {
    "title": "Your Medical Report Summary",
    "what_was_examined": "...",
    "key_findings": "...",
    "what_this_means": "...",
    "next_steps": "...",
    "when_to_contact_doctor": "...",
    "medical_disclaimer": "...",
    "glossary": [...]
  },
  "is_urgent": false,
  "emergency_indicators": [],
  "language": "en",
  "complexity_level": "basic"
}
```

#### Retrieve Summary
```http
GET /summaries/{summary_id}
```

#### Update Summary
```http
PUT /summaries/{summary_id}
```

#### List Summaries
```http
GET /summaries?patient_id={id}&language={lang}&page={page}
```

### Language Support

#### Get Supported Languages
```http
GET /languages
```

#### Get Language Details
```http
GET /languages/{language_code}
```

#### Get Cultural Contexts
```http
GET /languages/{language_code}/cultural-contexts
```

### Complexity Support

#### Get Complexity Levels
```http
GET /complexity-levels
```

#### Get Complexity Details
```http
GET /complexity-levels/{level}
```

### Health Check
```http
GET /health
```

## 🌍 Supported Languages & Cultures

| Language | Code | Regions | Cultural Adaptations |
|----------|------|---------|---------------------|
| German | `de` | DE, AT, CH | Formal communication, technical precision |
| English | `en` | US, GB | Patient empowerment, choice-oriented |
| French | `fr` | FR, BE | Intellectual approach, family involvement |
| Spanish | `es` | ES, MX | Warm communication, family-centered |
| Italian | `it` | IT | Expressive communication, family involvement |
| Turkish | `tr` | TR | Respectful communication, authority-based |

## 🧠 Complexity Levels

### Basic
- **Target**: General public, limited medical knowledge
- **Style**: Simple language, everyday words
- **Reading Level**: 6th-8th grade
- **Example**: "X-ray shows your bones are healthy"

### Intermediate  
- **Target**: Some medical background, higher education
- **Style**: Medical terms with explanations
- **Reading Level**: 9th-12th grade
- **Example**: "X-ray imaging shows normal bone density"

### Advanced
- **Target**: Healthcare professionals, medical students
- **Style**: Medical terminology with context
- **Reading Level**: College level
- **Example**: "Radiographic examination reveals normal osseous structures"

## 🚨 Emergency Detection

The service automatically detects emergency conditions in medical reports:

### Urgency Levels
- **Critical**: Life-threatening (e.g., heart attack, stroke)
- **High**: Urgent care needed (e.g., acute conditions)
- **Medium**: Prompt follow-up required
- **Low**: Routine monitoring

### Emergency Response
- Automatic emergency indicators in summaries
- Cultural-appropriate warning messages
- Immediate action recommendations
- Healthcare system-specific contact information

## 🔧 Medical Terminology

### Features
- **15,000+ Medical Terms**: Comprehensive medical dictionaries
- **Multi-language Translation**: Automatic term translation
- **Context-Aware Simplification**: Intelligent term replacement
- **Abbreviation Expansion**: Full forms with explanations
- **Category Organization**: Organized by medical specialty

### Example Translations

| German | English (Basic) | English (Advanced) |
|--------|-----------------|-------------------|
| Röntgenaufnahme | X-ray picture | Radiographic examination |
| Computertomographie | CT scan | Computed tomography imaging |
| Herzinfarkt | Heart attack | Myocardial infarction |

## 🏗️ Architecture

### Service Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Summary        │    │   OpenAI        │
│   Application   │───▶│   Generation     │───▶│   Service       │
│                 │    │   Service        │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   PostgreSQL     │
                       │   Database       │
                       └──────────────────┘
```

### Database Schema
- **patient_summaries**: Generated summaries
- **medical_terms**: Medical terminology dictionary
- **emergency_keywords**: Emergency condition detection
- **cultural_adaptations**: Cultural and regional settings
- **generation_metrics**: Performance and quality metrics

## 🔒 Security & Compliance

### Medical Compliance
- **HIPAA Considerations**: Patient data protection
- **Medical Disclaimers**: Required safety disclaimers
- **Quality Assurance**: AI-generated content validation
- **Audit Logging**: Complete operation tracking

### Security Features
- **Rate Limiting**: API abuse prevention
- **Input Validation**: Comprehensive request validation
- **Error Handling**: Secure error responses
- **Logging**: Security event monitoring

## 📊 Monitoring & Metrics

### Health Monitoring
- Application health checks
- Database connectivity monitoring
- OpenAI service availability
- Redis cache status

### Performance Metrics
- Summary generation time
- Token usage tracking
- Error rates and types
- Quality scores

### Logging
- Structured JSON logging
- Error tracking and alerting
- Performance monitoring
- Audit trail maintenance

## 🧪 Testing

### Running Tests
```bash
# Install test dependencies
pip install pytest pytest-asyncio

# Run tests
pytest tests/

# Run with coverage
pytest --cov=app tests/
```

### Test Categories
- **Unit Tests**: Service logic testing
- **Integration Tests**: Database and external service integration
- **API Tests**: Endpoint functionality
- **Medical Accuracy Tests**: Content validation

## 🚀 Deployment

### Docker Deployment
```bash
# Build and deploy
docker-compose up -d

# Scale services
docker-compose up -d --scale summary-generation=3

# View logs
docker-compose logs -f summary-generation
```

### Production Considerations
- **Load Balancing**: Multiple service instances
- **Database**: PostgreSQL with replication
- **Caching**: Redis cluster for high availability
- **Monitoring**: Prometheus/Grafana integration
- **SSL/TLS**: HTTPS encryption
- **Backup**: Regular database backups

## 🤝 Integration

### Report Generation Service
```python
# Example integration
import httpx

async def generate_patient_summary(report_id: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://summary-generation:8003/generate-summary",
            json={
                "report_text": medical_report_text,
                "language": "en",
                "complexity_level": "basic"
            }
        )
        return response.json()
```

### Frontend Integration
```typescript
// TypeScript example
interface SummaryRequest {
  reportText: string;
  language: string;
  complexityLevel: 'basic' | 'intermediate' | 'advanced';
  culturalContext?: string;
  region?: string;
}

const generateSummary = async (request: SummaryRequest) => {
  const response = await fetch('/api/generate-summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  return response.json();
};
```

## 🐛 Troubleshooting

### Common Issues

#### OpenAI API Errors
```bash
# Check API key configuration
docker-compose exec summary-generation env | grep OPENAI

# View OpenAI service logs
docker-compose logs summary-generation | grep -i openai
```

#### Database Connection Issues
```bash
# Check database connectivity
docker-compose exec postgres pg_isready

# Verify database initialization
docker-compose exec postgres psql -U postgres -d radiology_ai -c "\dt"
```

#### Memory Issues
```bash
# Monitor resource usage
docker stats

# Increase memory limits in docker-compose.yml
```

## 📝 Development

### Adding New Languages
1. Create medical terms dictionary in `app/data/medical_terms_XX.py`
2. Add cultural adaptations in `app/data/cultural_adaptations.py`
3. Update supported languages in configuration
4. Add language-specific templates

### Extending Medical Terminology
1. Add terms to appropriate language dictionaries
2. Include multiple complexity levels
3. Add medical categories and specialties
4. Test term simplification accuracy

### Custom Cultural Adaptations
1. Define communication styles
2. Add healthcare system information
3. Include cultural sensitivities
4. Test with native speakers

## 📄 License

This project is part of the Radiology AI System and follows the project's licensing terms.

## 🤝 Contributing

1. Follow medical accuracy guidelines
2. Test with medical professionals
3. Ensure cultural sensitivity
4. Maintain patient safety focus
5. Document all changes thoroughly

## 📞 Support

For technical support or medical terminology questions, please contact the development team or refer to the main project documentation.

---

**⚠️ Medical Disclaimer**: This service generates patient-friendly summaries for informational purposes only. All summaries include appropriate medical disclaimers and should not replace professional medical advice.