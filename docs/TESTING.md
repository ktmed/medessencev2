# Radiology AI System Test Suite

This comprehensive test suite validates the radiology AI system using real German medical data from the Excel file. The tests cover the complete workflow from audio transcription to patient summaries, with extensive validation of German medical terminology and report structure.

## Test Files Overview

### 1. Data Extraction
- **`extract_sample_data.py`** - Extracts sample German medical reports from the Excel file
- **Purpose**: Creates test data files organized by examination type
- **Output**: JSON files in `test_data/` directory

### 2. Individual Service Tests
- **`test_report_generation.py`** - Tests report generation service with German medical content
- **`test_summary_generation.py`** - Tests summary generation service with multiple languages
- **Purpose**: Validate individual service functionality and German medical processing

### 3. Integration Tests
- **`test_complete_workflow.py`** - Tests complete workflow (transcription → report → summary)
- **Purpose**: Validates end-to-end integration between all services

### 4. Validation Tests
- **`test_german_medical_validation.py`** - Validates German medical terminology and structure
- **Purpose**: Ensures compliance with German medical standards

### 5. Configuration and Utilities
- **`test_config.py`** - Test configuration and utility classes
- **`run_all_tests.py`** - Comprehensive test runner for all test categories

## Quick Start

### Prerequisites
1. Ensure all three services are running:
   - Transcription Service (port 8000)
   - Report Generation Service (port 8001)  
   - Summary Generation Service (port 8002)

2. Install required Python packages:
```bash
pip install pandas httpx asyncio
```

### Run All Tests (Recommended)
```bash
# Run complete test suite
python run_all_tests.py

# Run only service tests (faster)
python run_all_tests.py --services-only

# Run only validation tests
python run_all_tests.py --validation-only

# Skip data extraction (if already done)
python run_all_tests.py --skip-extraction
```

### Run Individual Test Components

#### 1. Extract Sample Data
```bash
python extract_sample_data.py
```
This creates:
- `test_data/sample_medical_data.json` - All extracted samples
- `test_data/samples_*.json` - Samples by examination type
- `test_data/extraction_summary.json` - Extraction statistics

#### 2. Test Report Generation Service
```bash
python test_report_generation.py
```
Tests:
- Report generation from German medical text
- German medical terminology validation
- ICD code suggestions
- Report quality assessment

#### 3. Test Summary Generation Service  
```bash
python test_summary_generation.py
```
Tests:
- Multi-language summary generation (German, English, Turkish, French)
- Different complexity levels (basic, intermediate, advanced)
- Cultural adaptations
- Emergency detection

#### 4. Test Complete Workflow
```bash
python test_complete_workflow.py
```
Tests:
- End-to-end workflow integration
- Data flow between services
- Cross-service consistency
- Performance metrics

#### 5. Validate German Medical Content
```bash
python test_german_medical_validation.py
```
Validates:
- German medical terminology usage
- Report structure compliance
- ICD-10-GM code validation
- Medical language quality

## Test Data Structure

### Sample Medical Data Format
```json
{
  "MR LWS nat.": [
    {
      "patient_id": "TEST_12345678",
      "examination_type": "MRI",
      "examination_type_original": "MR LWS nat.",
      "examination_date": "2020-01-02",
      "clinical_indication": "Ausschluss Wurzelirritation L5 rechts",
      "transcription": "Radiologische Allianz · Hohe Weide...",
      "icd_code": "G54.9",
      "patient_sex": 2,
      "patient_age_class": 15,
      "german_description": "MRT der Lendenwirbelsäule...",
      "metadata": {
        "source_row": 123,
        "extracted_at": "2024-01-01T10:00:00"
      }
    }
  ]
}
```

### Test Results Structure
Test results are saved in `test_data/results/` with timestamps:
- `*_test_results_YYYYMMDD_HHMMSS.json` - Detailed test results
- `final_test_report_YYYYMMDD_HHMMSS.json` - Comprehensive summary

## Examination Types Tested

The test suite includes samples from these German medical examinations:
- **MR LWS nat.** (MRI Lumbar Spine) - Spine imaging
- **MR HWS nat.** (MRI Cervical Spine) - Neck imaging  
- **Sono Mammae u.Ax** (Breast Ultrasound) - Breast examination
- **Planungs CT nat.** (Planning CT) - Radiation therapy planning
- **Dig.Mammo bds.2E** (Digital Mammography) - Breast cancer screening
- **Bestrahlung** (Radiation Therapy) - Cancer treatment reports

## Test Scenarios

### Multi-Language Testing
- **German** (de) - Native medical language
- **English** (en) - International standard
- **Turkish** (tr) - Cultural adaptation
- **French** (fr) - European healthcare context

### Complexity Levels
- **Basic** - Simple, patient-friendly language
- **Intermediate** - Moderate medical detail
- **Advanced** - Full medical terminology

### Cultural Contexts
- **German Healthcare** - German medical practices
- **Western Healthcare** - US/UK medical standards
- **Turkish Healthcare** - Turkish medical culture
- **French Healthcare** - French medical system

## Validation Criteria

### German Medical Terminology
- Medical term density and accuracy
- Radiology-specific vocabulary
- Anatomical terminology correctness
- Pathology term usage

### Report Structure
- Header and greeting patterns
- Patient information format
- Clinical indication structure
- Technical parameters section
- Findings and assessment format
- Professional closing

### ICD-10-GM Codes
- Format validation (e.g., G54.9, M53.1)
- Radiology relevance check
- Category classification

### Language Quality
- Formal medical language usage
- Appropriate medical passive voice
- Correct tense usage
- Medical abbreviation handling
- Avoidance of colloquialisms

## Performance Metrics

### Response Times
- Report Generation: Target < 60 seconds
- Summary Generation: Target < 120 seconds  
- Complete Workflow: Target < 300 seconds

### Quality Scores
- Confidence Score: Target > 80%
- Quality Score: Target > 70%
- Terminology Validation: Target > 70%

### Success Rates
- Individual Services: Target > 90%
- Integration Workflow: Target > 85%  
- German Validation: Target > 75%

## Troubleshooting

### Common Issues

#### Services Not Available
```
❌ Service health check failed
```
**Solution**: Ensure all services are running on correct ports

#### Sample Data Not Found
```
❌ Sample data file not found
```
**Solution**: Run data extraction first:
```bash
python extract_sample_data.py
```

#### Low Quality Scores
```
⚠️ Average quality score below threshold
```
**Solution**: Check service configurations and German medical terminology databases

#### Integration Test Failures
```
❌ Workflow integration failed
```
**Solution**: Verify service-to-service communication and data consistency

### Debug Mode
Enable detailed logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Test Results Interpretation

### Success Indicators
- ✅ **90%+ Success Rate** - Production ready
- ✅ **80-89% Success Rate** - Minor improvements needed  
- ⚠️ **70-79% Success Rate** - Significant improvements required
- ❌ **<70% Success Rate** - Major issues, not production ready

### Quality Indicators
- **Confidence Scores** - AI model confidence in results
- **Quality Scores** - Overall output quality assessment
- **Terminology Scores** - German medical term accuracy
- **Structure Scores** - Report format compliance

## Continuous Integration

For automated testing in CI/CD pipelines:

```bash
# Headless test execution
python run_all_tests.py --services-only --skip-extraction > test_results.log 2>&1

# Check exit code
if [ $? -eq 0 ]; then
    echo "Tests passed"
else
    echo "Tests failed"
    exit 1
fi
```

## Contributing

When adding new tests:
1. Follow the existing test pattern structure
2. Include German medical terminology validation
3. Add comprehensive error handling
4. Update this README with new test descriptions
5. Ensure tests are deterministic and repeatable

## Support

For issues with the test suite:
1. Check service health endpoints
2. Verify sample data extraction completed
3. Review test logs for specific error messages
4. Ensure all dependencies are installed
5. Check service port configurations

The test suite provides comprehensive validation of the radiology AI system's ability to process real German medical reports and generate accurate, culturally appropriate patient summaries across multiple languages.