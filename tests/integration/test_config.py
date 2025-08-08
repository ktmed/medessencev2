#!/usr/bin/env python3
"""
Test configuration and utilities for the radiology AI system testing suite.

This module provides configuration settings, test utilities, and helper functions
for comprehensive testing of the radiology AI system.
"""

import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

class ServiceType(Enum):
    """Available services in the radiology AI system."""
    TRANSCRIPTION = "transcription"
    REPORT_GENERATION = "report_generation"
    SUMMARY_GENERATION = "summary_generation"

class ExaminationType(Enum):
    """Supported examination types."""
    MRI = "MRI"
    CT = "CT"
    X_RAY = "X-Ray"
    ULTRASOUND = "Ultrasound"
    MAMMOGRAPHY = "Mammography"

class LanguageCode(Enum):
    """Supported language codes."""
    GERMAN = "de"
    ENGLISH = "en"
    TURKISH = "tr"
    FRENCH = "fr"
    SPANISH = "es"
    ITALIAN = "it"

class ComplexityLevel(Enum):
    """Summary complexity levels."""
    BASIC = "basic"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"

@dataclass
class ServiceConfig:
    """Configuration for a service."""
    name: str
    base_url: str
    port: int
    health_endpoint: str = "/health"
    timeout: int = 30
    max_retries: int = 3

@dataclass
class TestConfig:
    """Main test configuration."""
    
    # Service configurations
    services: Dict[ServiceType, ServiceConfig]
    
    # Test data paths
    test_data_dir: Path
    excel_file_path: Path
    
    # Test execution settings
    max_samples_per_type: int = 5
    test_timeout: int = 300
    parallel_execution: bool = False
    
    # Validation settings
    german_terminology_threshold: float = 0.7
    structure_completeness_threshold: float = 0.8
    icd_validation_required: bool = True
    
    # Report generation settings
    default_physician_id: str = "DR001"
    default_physician_name: str = "Dr. Test Physician"
    
    # Summary generation settings
    default_cultural_contexts: List[str]
    default_regions: List[str]
    include_glossary: bool = True
    emergency_detection: bool = True

def get_default_test_config() -> TestConfig:
    """Get default test configuration."""
    
    # Default service configurations
    services = {
        ServiceType.TRANSCRIPTION: ServiceConfig(
            name="Transcription Service",
            base_url="http://localhost:8000",
            port=8000,
            timeout=60
        ),
        ServiceType.REPORT_GENERATION: ServiceConfig(
            name="Report Generation Service", 
            base_url="http://localhost:8001",
            port=8001,
            timeout=120
        ),
        ServiceType.SUMMARY_GENERATION: ServiceConfig(
            name="Summary Generation Service",
            base_url="http://localhost:8002", 
            port=8002,
            timeout=180
        )
    }
    
    # Test data paths
    current_dir = Path(__file__).parent
    test_data_dir = current_dir / "test_data"
    excel_file_path = current_dir.parent / "latestcompleteexplanations3.xlsx"
    
    return TestConfig(
        services=services,
        test_data_dir=test_data_dir,
        excel_file_path=excel_file_path,
        max_samples_per_type=5,
        test_timeout=300,
        parallel_execution=False,
        german_terminology_threshold=0.7,
        structure_completeness_threshold=0.8,
        icd_validation_required=True,
        default_physician_id="DR001",
        default_physician_name="Dr. Test Physician",
        default_cultural_contexts=[
            "german_healthcare",
            "western_healthcare", 
            "turkish_healthcare",
            "french_healthcare"
        ],
        default_regions=[
            "germany",
            "usa",
            "turkey",
            "france"
        ],
        include_glossary=True,
        emergency_detection=True
    )

class TestScenario:
    """Represents a test scenario configuration."""
    
    def __init__(
        self,
        name: str,
        description: str,
        examination_type: ExaminationType,
        summary_language: LanguageCode,
        complexity_level: ComplexityLevel,
        cultural_context: str,
        region: str,
        expected_outcomes: Optional[Dict[str, Any]] = None
    ):
        self.name = name
        self.description = description
        self.examination_type = examination_type
        self.summary_language = summary_language
        self.complexity_level = complexity_level
        self.cultural_context = cultural_context
        self.region = region
        self.expected_outcomes = expected_outcomes or {}
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "name": self.name,
            "description": self.description,
            "examination_type": self.examination_type.value,
            "summary_language": self.summary_language.value,
            "complexity_level": self.complexity_level.value,
            "cultural_context": self.cultural_context,
            "region": self.region,
            "expected_outcomes": self.expected_outcomes
        }

def get_predefined_test_scenarios() -> List[TestScenario]:
    """Get predefined test scenarios for comprehensive testing."""
    
    scenarios = [
        TestScenario(
            name="German MRI Basic",
            description="Basic German MRI report processing and summarization",
            examination_type=ExaminationType.MRI,
            summary_language=LanguageCode.GERMAN,
            complexity_level=ComplexityLevel.BASIC,
            cultural_context="german_healthcare",
            region="germany",
            expected_outcomes={
                "min_confidence_score": 80,
                "min_quality_score": 70,
                "max_processing_time": 60
            }
        ),
        TestScenario(
            name="English CT Intermediate",
            description="Intermediate English CT report processing with cultural adaptation",
            examination_type=ExaminationType.CT,
            summary_language=LanguageCode.ENGLISH,
            complexity_level=ComplexityLevel.INTERMEDIATE,
            cultural_context="western_healthcare",
            region="usa",
            expected_outcomes={
                "min_confidence_score": 75,
                "min_quality_score": 70,
                "max_processing_time": 90
            }
        ),
        TestScenario(
            name="Turkish Ultrasound Basic",
            description="Basic Turkish ultrasound report with cultural sensitivity",
            examination_type=ExaminationType.ULTRASOUND,
            summary_language=LanguageCode.TURKISH,
            complexity_level=ComplexityLevel.BASIC,
            cultural_context="turkish_healthcare",
            region="turkey",
            expected_outcomes={
                "min_confidence_score": 70,
                "min_quality_score": 65,
                "max_processing_time": 120
            }
        ),
        TestScenario(
            name="French Mammography Advanced",
            description="Advanced French mammography report processing",
            examination_type=ExaminationType.MAMMOGRAPHY,
            summary_language=LanguageCode.FRENCH,
            complexity_level=ComplexityLevel.ADVANCED,
            cultural_context="french_healthcare",
            region="france",
            expected_outcomes={
                "min_confidence_score": 75,
                "min_quality_score": 70,
                "max_processing_time": 100
            }
        ),
        TestScenario(
            name="German X-Ray Emergency",
            description="German X-ray with emergency detection capabilities",
            examination_type=ExaminationType.X_RAY,
            summary_language=LanguageCode.GERMAN,
            complexity_level=ComplexityLevel.INTERMEDIATE,
            cultural_context="german_healthcare",
            region="germany",
            expected_outcomes={
                "min_confidence_score": 80,
                "min_quality_score": 75,
                "max_processing_time": 45,
                "emergency_detection_required": True
            }
        )
    ]
    
    return scenarios

class TestDataManager:
    """Manages test data and provides utilities for test execution."""
    
    def __init__(self, config: TestConfig):
        self.config = config
        self.test_data_dir = config.test_data_dir
        self.test_data_dir.mkdir(exist_ok=True)
    
    def get_sample_data_path(self) -> Path:
        """Get path to sample medical data file."""
        return self.test_data_dir / "sample_medical_data.json"
    
    def get_test_results_dir(self) -> Path:
        """Get directory for test results."""
        results_dir = self.test_data_dir / "results"
        results_dir.mkdir(exist_ok=True)
        return results_dir
    
    def generate_test_report_filename(self, test_type: str) -> str:
        """Generate filename for test report."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"{test_type}_test_results_{timestamp}.json"
    
    def get_extraction_summary_path(self) -> Path:
        """Get path to extraction summary file."""
        return self.test_data_dir / "extraction_summary.json"

class TestValidator:
    """Validates test results against expected outcomes."""
    
    def __init__(self, config: TestConfig):
        self.config = config
    
    def validate_service_response(
        self, 
        response_data: Dict[str, Any], 
        scenario: TestScenario
    ) -> Dict[str, Any]:
        """Validate service response against scenario expectations."""
        
        validation_result = {
            "scenario_name": scenario.name,
            "validation_passed": True,
            "validation_errors": [],
            "validation_warnings": [],
            "validation_score": 0
        }
        
        expected = scenario.expected_outcomes
        
        # Validate confidence score
        if "min_confidence_score" in expected:
            actual_confidence = response_data.get("confidence_score", 0)
            if actual_confidence < expected["min_confidence_score"]:
                validation_result["validation_passed"] = False
                validation_result["validation_errors"].append(
                    f"Confidence score {actual_confidence} below minimum {expected['min_confidence_score']}"
                )
        
        # Validate quality score
        if "min_quality_score" in expected:
            actual_quality = response_data.get("quality_score", 0)
            if actual_quality < expected["min_quality_score"]:
                validation_result["validation_passed"] = False
                validation_result["validation_errors"].append(
                    f"Quality score {actual_quality} below minimum {expected['min_quality_score']}"
                )
        
        # Validate emergency detection
        if expected.get("emergency_detection_required"):
            if "emergency_indicators" not in response_data:
                validation_result["validation_passed"] = False
                validation_result["validation_errors"].append(
                    "Emergency detection required but not present in response"
                )
        
        # Calculate validation score
        total_checks = len(expected)
        passed_checks = total_checks - len(validation_result["validation_errors"])
        validation_result["validation_score"] = (passed_checks / total_checks * 100) if total_checks > 0 else 100
        
        return validation_result
    
    def validate_processing_time(self, processing_time: float, max_allowed: float) -> bool:
        """Validate processing time is within acceptable limits."""
        return processing_time <= max_allowed
    
    def validate_german_content(self, content: str) -> Dict[str, Any]:
        """Validate German language content quality."""
        
        # Basic German validation
        german_indicators = ["der", "die", "das", "und", "oder", "mit", "für", "von"]
        found_indicators = sum(1 for indicator in german_indicators if indicator in content.lower())
        
        return {
            "is_german_content": found_indicators >= 3,
            "german_indicator_count": found_indicators,
            "content_length": len(content),
            "validation_score": min(100, (found_indicators / len(german_indicators)) * 100)
        }

class TestReporter:
    """Generates test reports and summaries."""
    
    def __init__(self, config: TestConfig):
        self.config = config
        self.data_manager = TestDataManager(config)
    
    def generate_comprehensive_report(
        self, 
        test_results: List[Dict[str, Any]], 
        test_type: str
    ) -> Dict[str, Any]:
        """Generate comprehensive test report."""
        
        total_tests = len(test_results)
        successful_tests = [r for r in test_results if r.get("success", False)]
        failed_tests = [r for r in test_results if not r.get("success", False)]
        
        report = {
            "report_metadata": {
                "generated_at": datetime.now().isoformat(),
                "test_type": test_type,
                "total_tests": total_tests,
                "successful_tests": len(successful_tests),
                "failed_tests": len(failed_tests),
                "success_rate": len(successful_tests) / total_tests * 100 if total_tests > 0 else 0
            },
            "configuration": {
                "services": {k.value: v.__dict__ for k, v in self.config.services.items()},
                "test_settings": {
                    "max_samples_per_type": self.config.max_samples_per_type,
                    "test_timeout": self.config.test_timeout,
                    "parallel_execution": self.config.parallel_execution
                }
            },
            "performance_metrics": self._calculate_performance_metrics(successful_tests),
            "quality_metrics": self._calculate_quality_metrics(successful_tests),
            "error_analysis": self._analyze_errors(failed_tests),
            "detailed_results": test_results
        }
        
        return report
    
    def _calculate_performance_metrics(self, successful_tests: List[Dict[str, Any]]) -> Dict[str, float]:
        """Calculate performance metrics from successful tests."""
        if not successful_tests:
            return {}
        
        processing_times = [t.get("processing_time", 0) for t in successful_tests]
        
        return {
            "average_processing_time": sum(processing_times) / len(processing_times),
            "min_processing_time": min(processing_times),
            "max_processing_time": max(processing_times),
            "total_processing_time": sum(processing_times)
        }
    
    def _calculate_quality_metrics(self, successful_tests: List[Dict[str, Any]]) -> Dict[str, float]:
        """Calculate quality metrics from successful tests."""
        if not successful_tests:
            return {}
        
        confidence_scores = [t.get("confidence_score", 0) for t in successful_tests if t.get("confidence_score")]
        quality_scores = [t.get("quality_score", 0) for t in successful_tests if t.get("quality_score")]
        
        metrics = {}
        
        if confidence_scores:
            metrics.update({
                "average_confidence_score": sum(confidence_scores) / len(confidence_scores),
                "min_confidence_score": min(confidence_scores),
                "max_confidence_score": max(confidence_scores)
            })
        
        if quality_scores:
            metrics.update({
                "average_quality_score": sum(quality_scores) / len(quality_scores),
                "min_quality_score": min(quality_scores),
                "max_quality_score": max(quality_scores)
            })
        
        return metrics
    
    def _analyze_errors(self, failed_tests: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze errors from failed tests."""
        if not failed_tests:
            return {"error_count": 0, "common_errors": []}
        
        errors = []
        for test in failed_tests:
            error = test.get("error", "Unknown error")
            errors.append(error[:100])  # First 100 characters
        
        from collections import Counter
        error_counts = Counter(errors)
        
        return {
            "error_count": len(failed_tests),
            "unique_errors": len(error_counts),
            "common_errors": [
                {"error": error, "count": count} 
                for error, count in error_counts.most_common(5)
            ]
        }

# Utility functions

def setup_test_environment() -> TestConfig:
    """Set up the test environment with default configuration."""
    config = get_default_test_config()
    
    # Ensure test data directory exists
    config.test_data_dir.mkdir(exist_ok=True)
    
    return config

def get_test_scenarios_by_language(language: LanguageCode) -> List[TestScenario]:
    """Get test scenarios filtered by language."""
    all_scenarios = get_predefined_test_scenarios()
    return [s for s in all_scenarios if s.summary_language == language]

def get_test_scenarios_by_examination_type(exam_type: ExaminationType) -> List[TestScenario]:
    """Get test scenarios filtered by examination type."""
    all_scenarios = get_predefined_test_scenarios()
    return [s for s in all_scenarios if s.examination_type == exam_type]

# Constants for easy import
DEFAULT_TEST_CONFIG = get_default_test_config()
PREDEFINED_SCENARIOS = get_predefined_test_scenarios()