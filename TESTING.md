# MedEssenceAI Testing Guide

## Test Suite Status
- **Current Pass Rate**: ~55% (improving from 35%)
- **Total Tests**: 188
- **Critical Components**: WebSpeechRecorder, ReportViewer, SummaryGenerator, ICDPredictions

## Running Tests

### Frontend Tests
```bash
cd frontend

# Run all tests
npm test

# Run tests once (CI mode)
npm test -- --watchAll=false

# Run with coverage
npm test -- --coverage --watchAll=false

# Run specific test file
npm test WebSpeechRecorder

# Clear Jest cache if tests are behaving strangely
npx jest --clearCache
```

### Backend Tests
```bash
cd backend

# Ensure PostgreSQL and Redis are running
brew services start postgresql@16
brew services start redis

# Run tests
npm test

# Run specific test
npm test -- apiService
```

### Ontology Service Tests
```bash
cd services/semantic

# Install Python dependencies
pip install -r requirements.txt

# Run Python tests
python -m pytest

# Start ontology service for integration tests
python api_server.py
```

## Test Infrastructure

### Mock Structure
The project uses manual mocks for complex hooks and services:

- `frontend/__mocks__/useEnhancedSpeechToText.js` - Speech recognition hook mock
- `frontend/__mocks__/utils.js` - Utility functions mock
- `frontend/__mocks__/languages.js` - German medical terminology mock
- `frontend/src/hooks/__mocks__/` - Component-specific hook mocks

### Key Test Features

#### Medical Validation Tests
- German medical term recognition
- ICD-10-GM code prediction accuracy
- Medical report structure validation
- Confidence scoring thresholds

#### Integration Tests
- Multi-LLM fallback chain (Claude → Gemini → OpenAI → Ollama)
- WebSocket connection between frontend and backend
- PostgreSQL database operations
- Redis caching layer

#### Component Tests
- WebSpeechRecorder: Real-time transcription UI
- ReportViewer: Medical report generation
- SummaryGenerator: AI-powered summarization
- ICDPredictions: Dual-provider ICD code suggestions

## Common Issues & Solutions

### Issue: Tests fail with "Cannot read properties of undefined"
**Solution**: Check that all required mock properties are defined in the mock files.

### Issue: "Module not found" errors
**Solution**: Clear Jest cache with `npx jest --clearCache`

### Issue: Database connection errors in backend tests
**Solution**: Ensure PostgreSQL is running: `brew services start postgresql@16`

### Issue: Ontology service unavailable
**Solution**: Start the ontology service: `cd services/semantic && python api_server.py`

## CI/CD Pipeline

The project includes GitHub Actions workflow (`.github/workflows/ci.yml`) that:

1. **Frontend Tests**: Runs Jest tests with coverage
2. **Backend Tests**: Runs with PostgreSQL and Redis services
3. **Build Verification**: Ensures production build succeeds
4. **Medical Validation**: Validates medical dictionaries and ICD codes
5. **Security Scanning**: Checks for vulnerabilities and exposed secrets

### Deployment Stages
- **Develop Branch**: Triggers staging deployment
- **Main Branch**: Production deployment (requires manual approval)

## Test Coverage Goals

### Critical Path Coverage (Target: 90%)
- [ ] Speech recognition initialization
- [ ] Medical term validation
- [ ] Report generation workflow
- [ ] ICD code prediction
- [ ] Multi-LLM fallback logic

### Nice-to-Have Coverage (Target: 70%)
- [ ] UI component interactions
- [ ] Error boundary handling
- [ ] WebSocket reconnection logic
- [ ] Cache invalidation

## Debugging Tests

### Enable Verbose Output
```bash
npm test -- --verbose
```

### Debug Single Test
```bash
node --inspect-brk ./node_modules/.bin/jest --runInBand
```

### View Test Coverage Report
```bash
npm test -- --coverage
open coverage/lcov-report/index.html
```

## Best Practices

1. **Always run tests before committing**
2. **Fix failing tests immediately** - don't let technical debt accumulate
3. **Write tests for new features** - aim for 80% coverage on new code
4. **Use descriptive test names** - should explain what and why
5. **Mock external dependencies** - tests should be deterministic
6. **Test medical accuracy** - validate German medical terminology

## Contact

For test-related issues or questions about the medical validation pipeline, refer to the main README.md or create an issue in the repository.