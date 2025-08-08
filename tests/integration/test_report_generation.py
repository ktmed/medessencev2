#!/usr/bin/env python3
"""
Test the report generation service with real German medical data.

This script tests the report generation service using extracted German medical reports
from the Excel file, validating German medical terminology and report structure.
"""

import asyncio
import json
import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
import httpx
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ReportGenerationTester:
    """Test report generation service with German medical data."""
    
    def __init__(self, base_url: str = "http://localhost:8001", test_data_path: str = "test_data"):
        self.base_url = base_url
        self.test_data_path = Path(test_data_path)
        self.sample_data = {}
        self.test_results = []
        
    async def load_test_data(self):
        """Load the extracted sample data."""
        sample_file = self.test_data_path / "sample_medical_data.json"
        
        if not sample_file.exists():
            raise FileNotFoundError(f"Sample data file not found: {sample_file}")
        
        with open(sample_file, 'r', encoding='utf-8') as f:
            self.sample_data = json.load(f)
        
        logger.info(f"Loaded test data for {len(self.sample_data)} examination types")
        
        # Log examination types
        for exam_type, samples in self.sample_data.items():
            logger.info(f"  {exam_type}: {len(samples)} samples")
    
    async def check_service_health(self) -> bool:
        """Check if the report generation service is running."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/health")
                if response.status_code == 200:
                    health_data = response.json()
                    logger.info(f"Service health check passed: {health_data}")
                    return True
                else:
                    logger.error(f"Health check failed with status {response.status_code}")
                    return False
        except Exception as e:
            logger.error(f"Failed to connect to service: {e}")
            return False
    
    async def test_report_generation(self, sample: Dict[str, Any], exam_type: str) -> Dict[str, Any]:
        """Test report generation for a single sample."""
        logger.info(f"Testing report generation for {exam_type}")
        
        # Prepare request payload
        request_payload = {
            "transcription": sample["transcription"],
            "examination_type": sample["examination_type"],
            "clinical_indication": sample["clinical_indication"],
            "patient_id": sample["patient_id"],
            "examination_date": f"{sample['examination_date']}T10:00:00",
            "dictating_physician_id": "DR001",
            "dictating_physician_name": "Dr. Test Physician"
        }
        
        start_time = time.time()
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/v1/reports/generate",
                    json=request_payload
                )
                
                processing_time = time.time() - start_time
                
                if response.status_code == 201:
                    result_data = response.json()
                    
                    test_result = {
                        "examination_type": exam_type,
                        "original_examination_type": sample["examination_type_original"],
                        "patient_id": sample["patient_id"],
                        "success": True,
                        "status_code": response.status_code,
                        "processing_time": processing_time,
                        "report_id": result_data.get("report_id"),
                        "confidence_score": result_data.get("confidence_score"),
                        "quality_score": result_data.get("quality_score"),
                        "terminology_validation": result_data.get("terminology_validation"),
                        "suggested_icd_codes": result_data.get("suggested_icd_codes"),
                        "quality_assessment": result_data.get("quality_assessment"),
                        "compliance_flags": result_data.get("compliance_flags"),
                        "original_icd_code": sample.get("icd_code"),
                        "clinical_indication": sample["clinical_indication"],
                        "transcription_length": len(sample["transcription"]),
                        "error": None
                    }
                    
                    logger.info(f"✅ Report generated successfully for {exam_type}")
                    logger.info(f"   Report ID: {result_data.get('report_id')}")
                    logger.info(f"   Confidence: {result_data.get('confidence_score')}")
                    logger.info(f"   Quality: {result_data.get('quality_score')}")
                    
                    return test_result
                    
                else:
                    error_detail = response.text
                    test_result = {
                        "examination_type": exam_type,
                        "original_examination_type": sample["examination_type_original"],
                        "patient_id": sample["patient_id"],
                        "success": False,
                        "status_code": response.status_code,
                        "processing_time": processing_time,
                        "error": error_detail,
                        "clinical_indication": sample["clinical_indication"],
                        "transcription_length": len(sample["transcription"])
                    }
                    
                    logger.error(f"❌ Report generation failed for {exam_type}: {error_detail}")
                    return test_result
                    
        except Exception as e:
            processing_time = time.time() - start_time
            test_result = {
                "examination_type": exam_type,
                "original_examination_type": sample["examination_type_original"],
                "patient_id": sample["patient_id"],
                "success": False,
                "status_code": None,
                "processing_time": processing_time,
                "error": str(e),
                "clinical_indication": sample["clinical_indication"],
                "transcription_length": len(sample["transcription"])
            }
            
            logger.error(f"❌ Exception during report generation for {exam_type}: {e}")
            return test_result
    
    async def test_report_retrieval(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Test retrieving a generated report."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{self.base_url}/api/v1/reports/{report_id}")
                
                if response.status_code == 200:
                    report_data = response.json()
                    logger.info(f"✅ Report retrieved successfully: {report_id}")
                    return report_data
                else:
                    logger.error(f"❌ Failed to retrieve report {report_id}: {response.status_code}")
                    return None
        except Exception as e:
            logger.error(f"❌ Exception retrieving report {report_id}: {e}")
            return None
    
    async def validate_german_terminology(self, report_content: str) -> Dict[str, Any]:
        """Validate German medical terminology in the report."""
        
        # Common German medical terms that should be present
        german_medical_terms = [
            "befund", "diagnose", "untersuchung", "patient", "technik",
            "beurteilung", "empfehlung", "therapie", "behandlung", "anatomie",
            "klinik", "symptom", "therapie", "medikament", "operation"
        ]
        
        # Radiology-specific German terms
        radiology_terms = [
            "röntgen", "computertomographie", "magnetresonanztomographie", 
            "ultraschall", "mammographie", "kontrastmittel", "bilgebung",
            "schnittbild", "aufnahme", "projektion", "schicht"
        ]
        
        content_lower = report_content.lower()
        
        found_medical_terms = [term for term in german_medical_terms if term in content_lower]
        found_radiology_terms = [term for term in radiology_terms if term in content_lower]
        
        terminology_score = (len(found_medical_terms) + len(found_radiology_terms)) / \
                           (len(german_medical_terms) + len(radiology_terms)) * 100
        
        return {
            "terminology_score": round(terminology_score, 2),
            "found_medical_terms": found_medical_terms,
            "found_radiology_terms": found_radiology_terms,
            "total_terms_found": len(found_medical_terms) + len(found_radiology_terms),
            "contains_german_content": any(term in content_lower for term in ["der", "die", "das", "und", "oder", "mit"])
        }
    
    async def run_comprehensive_tests(self):
        """Run comprehensive tests on all sample data."""
        logger.info("🧪 Starting comprehensive report generation tests")
        
        # Check service health first
        if not await self.check_service_health():
            logger.error("❌ Service health check failed. Please ensure the service is running.")
            return
        
        # Load test data
        await self.load_test_data()
        
        all_results = []
        
        # Test each examination type
        for exam_type, samples in self.sample_data.items():
            logger.info(f"\n📋 Testing examination type: {exam_type}")
            logger.info(f"   Available samples: {len(samples)}")
            
            for i, sample in enumerate(samples):
                logger.info(f"\n   Testing sample {i+1}/{len(samples)}")
                
                result = await self.test_report_generation(sample, exam_type)
                all_results.append(result)
                
                # If generation was successful, test retrieval
                if result["success"] and result.get("report_id"):
                    logger.info(f"   Testing report retrieval...")
                    retrieved_report = await self.test_report_retrieval(result["report_id"])
                    
                    if retrieved_report:
                        # Validate German terminology if report content is available
                        report_content = retrieved_report.get("findings", "") + " " + \
                                       retrieved_report.get("assessment", "")
                        
                        if report_content.strip():
                            terminology_validation = await self.validate_german_terminology(report_content)
                            result["german_terminology_validation"] = terminology_validation
                            
                            logger.info(f"   German terminology score: {terminology_validation['terminology_score']}%")
                
                # Add small delay between tests
                await asyncio.sleep(1)
        
        # Save test results
        await self.save_test_results(all_results)
        
        # Generate summary
        await self.generate_test_summary(all_results)
    
    async def save_test_results(self, results: List[Dict[str, Any]]):
        """Save detailed test results."""
        results_file = self.test_data_path / f"report_generation_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        test_summary = {
            "test_timestamp": datetime.now().isoformat(),
            "total_tests": len(results),
            "successful_tests": len([r for r in results if r["success"]]),
            "failed_tests": len([r for r in results if not r["success"]]),
            "service_base_url": self.base_url,
            "detailed_results": results
        }
        
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(test_summary, f, indent=2, ensure_ascii=False)
        
        logger.info(f"💾 Test results saved to: {results_file}")
    
    async def generate_test_summary(self, results: List[Dict[str, Any]]):
        """Generate and display test summary."""
        total_tests = len(results)
        successful_tests = [r for r in results if r["success"]]
        failed_tests = [r for r in results if not r["success"]]
        
        logger.info(f"\n📊 TEST SUMMARY")
        logger.info(f"================")
        logger.info(f"Total tests: {total_tests}")
        logger.info(f"Successful: {len(successful_tests)} ({len(successful_tests)/total_tests*100:.1f}%)")
        logger.info(f"Failed: {len(failed_tests)} ({len(failed_tests)/total_tests*100:.1f}%)")
        
        if successful_tests:
            avg_processing_time = sum(r["processing_time"] for r in successful_tests) / len(successful_tests)
            avg_confidence = sum(r.get("confidence_score", 0) for r in successful_tests) / len(successful_tests)
            avg_quality = sum(r.get("quality_score", 0) for r in successful_tests) / len(successful_tests)
            
            logger.info(f"\nPerformance Metrics (Successful Tests):")
            logger.info(f"Average processing time: {avg_processing_time:.2f} seconds")
            logger.info(f"Average confidence score: {avg_confidence:.1f}")
            logger.info(f"Average quality score: {avg_quality:.1f}")
        
        # Show results by examination type
        exam_type_results = {}
        for result in results:
            exam_type = result["examination_type"]
            if exam_type not in exam_type_results:
                exam_type_results[exam_type] = {"success": 0, "failed": 0}
            
            if result["success"]:
                exam_type_results[exam_type]["success"] += 1
            else:
                exam_type_results[exam_type]["failed"] += 1
        
        logger.info(f"\nResults by Examination Type:")
        for exam_type, counts in exam_type_results.items():
            total = counts["success"] + counts["failed"]
            success_rate = counts["success"] / total * 100 if total > 0 else 0
            logger.info(f"  {exam_type}: {counts['success']}/{total} ({success_rate:.1f}%)")
        
        # Show common errors if any
        if failed_tests:
            logger.info(f"\nCommon Errors:")
            error_counts = {}
            for result in failed_tests:
                error = result.get("error", "Unknown error")
                error_key = error[:100]  # First 100 chars
                error_counts[error_key] = error_counts.get(error_key, 0) + 1
            
            for error, count in sorted(error_counts.items(), key=lambda x: x[1], reverse=True):
                logger.info(f"  ({count}x): {error}")
        
        # German terminology validation summary
        german_validation_results = [r for r in successful_tests if "german_terminology_validation" in r]
        if german_validation_results:
            avg_terminology_score = sum(
                r["german_terminology_validation"]["terminology_score"] 
                for r in german_validation_results
            ) / len(german_validation_results)
            
            logger.info(f"\nGerman Terminology Validation:")
            logger.info(f"Average terminology score: {avg_terminology_score:.1f}%")
            logger.info(f"Reports with German content: {len([r for r in german_validation_results if r['german_terminology_validation']['contains_german_content']])}")


async def main():
    """Main test function."""
    # Configuration
    SERVICE_URL = "http://localhost:8001"  # Adjust if service runs on different port
    TEST_DATA_PATH = "radiology-ai-system/test_data"
    
    logger.info("🚀 Starting Report Generation Service Tests")
    logger.info(f"Service URL: {SERVICE_URL}")
    logger.info(f"Test data path: {TEST_DATA_PATH}")
    
    tester = ReportGenerationTester(SERVICE_URL, TEST_DATA_PATH)
    
    try:
        await tester.run_comprehensive_tests()
        logger.info("✅ All tests completed successfully!")
    except Exception as e:
        logger.error(f"❌ Test execution failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())