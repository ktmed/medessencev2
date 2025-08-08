#!/usr/bin/env python3
"""
Test the summary generation service with real German medical reports.

This script tests the summary generation service using German medical reports,
testing different languages, complexity levels, and cultural adaptations.
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

class SummaryGenerationTester:
    """Test summary generation service with German medical data."""
    
    def __init__(self, base_url: str = "http://localhost:8002", test_data_path: str = "test_data"):
        self.base_url = base_url
        self.test_data_path = Path(test_data_path)
        self.sample_data = {}
        self.test_results = []
        
        # Test configurations for different scenarios
        self.test_configurations = [
            {
                "language": "de",
                "complexity_level": "basic",
                "cultural_context": "german_healthcare",
                "region": "germany",
                "name": "German Basic"
            },
            {
                "language": "de", 
                "complexity_level": "intermediate",
                "cultural_context": "german_healthcare",
                "region": "germany",
                "name": "German Intermediate"
            },
            {
                "language": "en",
                "complexity_level": "basic",
                "cultural_context": "western_healthcare",
                "region": "usa",
                "name": "English Basic"
            },
            {
                "language": "tr",
                "complexity_level": "basic",
                "cultural_context": "turkish_healthcare",
                "region": "turkey",
                "name": "Turkish Basic"
            },
            {
                "language": "fr",
                "complexity_level": "intermediate",
                "cultural_context": "french_healthcare",
                "region": "france",
                "name": "French Intermediate"
            }
        ]
    
    async def load_test_data(self):
        """Load the extracted sample medical reports."""
        sample_file = self.test_data_path / "sample_medical_data.json"
        
        if not sample_file.exists():
            raise FileNotFoundError(f"Sample data file not found: {sample_file}")
        
        with open(sample_file, 'r', encoding='utf-8') as f:
            self.sample_data = json.load(f)
        
        logger.info(f"Loaded test data for {len(self.sample_data)} examination types")
    
    async def check_service_health(self) -> bool:
        """Check if the summary generation service is running."""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/health")
                if response.status_code == 200:
                    health_data = response.json()
                    logger.info(f"Summary service health check passed: {health_data}")
                    return True
                else:
                    logger.error(f"Health check failed with status {response.status_code}")
                    return False
        except Exception as e:
            logger.error(f"Failed to connect to summary service: {e}")
            return False
    
    async def test_summary_generation(
        self, 
        report_text: str, 
        config: Dict[str, Any],
        exam_type: str,
        patient_id: str
    ) -> Dict[str, Any]:
        """Test summary generation for a single report with specific configuration."""
        
        logger.info(f"Testing summary generation: {config['name']} for {exam_type}")
        
        # Prepare request payload
        request_payload = {
            "report_text": report_text,
            "language": config["language"],
            "complexity_level": config["complexity_level"],
            "cultural_context": config["cultural_context"],
            "region": config["region"],
            "patient_id": patient_id,
            "include_glossary": True,
            "emergency_detection": True,
            "explanation_style": "empathetic"
        }
        
        start_time = time.time()
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:  # Longer timeout for AI processing
                response = await client.post(
                    f"{self.base_url}/api/v1/summaries/generate-summary",
                    json=request_payload
                )
                
                processing_time = time.time() - start_time
                
                if response.status_code == 200:
                    result_data = response.json()
                    
                    test_result = {
                        "configuration": config["name"],
                        "language": config["language"],
                        "complexity_level": config["complexity_level"],
                        "examination_type": exam_type,
                        "patient_id": patient_id,
                        "success": True,
                        "status_code": response.status_code,
                        "processing_time": processing_time,
                        "summary_id": result_data.get("id"),
                        "summary_content": result_data.get("summary"),
                        "key_findings": result_data.get("key_findings"),
                        "medical_terms_explained": result_data.get("medical_terms_explained"),
                        "emergency_indicators": result_data.get("emergency_indicators"),
                        "is_urgent": result_data.get("is_urgent"),
                        "confidence_score": result_data.get("confidence_score"),
                        "cultural_adaptations": result_data.get("cultural_adaptations"),
                        "region_specific_info": result_data.get("region_specific_info"),
                        "reading_time_minutes": result_data.get("reading_time_minutes"),
                        "original_report_length": len(report_text),
                        "summary_length": len(result_data.get("summary", "")),
                        "compression_ratio": len(result_data.get("summary", "")) / len(report_text) if report_text else 0,
                        "error": None
                    }
                    
                    logger.info(f"✅ Summary generated successfully")
                    logger.info(f"   Language: {config['language']}")
                    logger.info(f"   Summary ID: {result_data.get('id')}")
                    logger.info(f"   Compression ratio: {test_result['compression_ratio']:.2f}")
                    logger.info(f"   Is urgent: {result_data.get('is_urgent')}")
                    
                    return test_result
                    
                else:
                    error_detail = response.text
                    test_result = {
                        "configuration": config["name"],
                        "language": config["language"],
                        "complexity_level": config["complexity_level"],
                        "examination_type": exam_type,
                        "patient_id": patient_id,
                        "success": False,
                        "status_code": response.status_code,
                        "processing_time": processing_time,
                        "error": error_detail,
                        "original_report_length": len(report_text)
                    }
                    
                    logger.error(f"❌ Summary generation failed: {error_detail}")
                    return test_result
                    
        except Exception as e:
            processing_time = time.time() - start_time
            test_result = {
                "configuration": config["name"],
                "language": config["language"],
                "complexity_level": config["complexity_level"],
                "examination_type": exam_type,
                "patient_id": patient_id,
                "success": False,
                "status_code": None,
                "processing_time": processing_time,
                "error": str(e),
                "original_report_length": len(report_text)
            }
            
            logger.error(f"❌ Exception during summary generation: {e}")
            return test_result
    
    async def test_summary_retrieval(self, summary_id: str) -> Optional[Dict[str, Any]]:
        """Test retrieving a generated summary."""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{self.base_url}/api/v1/summaries/{summary_id}")
                
                if response.status_code == 200:
                    summary_data = response.json()
                    logger.info(f"✅ Summary retrieved successfully: {summary_id}")
                    return summary_data
                else:
                    logger.error(f"❌ Failed to retrieve summary {summary_id}: {response.status_code}")
                    return None
        except Exception as e:
            logger.error(f"❌ Exception retrieving summary {summary_id}: {e}")
            return None
    
    async def validate_summary_quality(self, summary_result: Dict[str, Any]) -> Dict[str, Any]:
        """Validate the quality of generated summary."""
        
        if not summary_result["success"]:
            return {"quality_score": 0, "validation_errors": ["Generation failed"]}
        
        summary_content = summary_result.get("summary_content", "")
        language = summary_result.get("language", "de")
        
        validation_results = {
            "quality_score": 0,
            "validation_errors": [],
            "validation_warnings": [],
            "language_checks": {},
            "content_checks": {},
            "accessibility_checks": {}
        }
        
        # Language-specific validation
        if language == "de":
            validation_results["language_checks"] = await self._validate_german_content(summary_content)
        elif language == "en":
            validation_results["language_checks"] = await self._validate_english_content(summary_content)
        elif language == "tr":
            validation_results["language_checks"] = await self._validate_turkish_content(summary_content)
        elif language == "fr":
            validation_results["language_checks"] = await self._validate_french_content(summary_content)
        
        # Content quality checks
        validation_results["content_checks"] = {
            "has_summary": bool(summary_content and len(summary_content) > 50),
            "has_key_findings": bool(summary_result.get("key_findings")),
            "has_medical_explanations": bool(summary_result.get("medical_terms_explained")),
            "appropriate_length": 100 <= len(summary_content) <= 2000,
            "compression_ratio_reasonable": 0.1 <= summary_result.get("compression_ratio", 0) <= 0.8
        }
        
        # Accessibility checks
        validation_results["accessibility_checks"] = {
            "reading_time_specified": summary_result.get("reading_time_minutes") is not None,
            "complexity_appropriate": summary_result.get("complexity_level") in ["basic", "intermediate", "advanced"],
            "cultural_adaptation_present": bool(summary_result.get("cultural_adaptations")),
            "emergency_detection_working": "emergency_indicators" in summary_result
        }
        
        # Calculate overall quality score
        language_score = sum(validation_results["language_checks"].values()) / len(validation_results["language_checks"]) if validation_results["language_checks"] else 0
        content_score = sum(validation_results["content_checks"].values()) / len(validation_results["content_checks"])
        accessibility_score = sum(validation_results["accessibility_checks"].values()) / len(validation_results["accessibility_checks"])
        
        validation_results["quality_score"] = round((language_score + content_score + accessibility_score) / 3 * 100, 1)
        
        return validation_results
    
    async def _validate_german_content(self, content: str) -> Dict[str, bool]:
        """Validate German language content."""
        content_lower = content.lower()
        
        return {
            "contains_german_articles": any(word in content_lower for word in ["der", "die", "das", "dem", "den"]),
            "contains_medical_terms": any(word in content_lower for word in ["befund", "untersuchung", "diagnose", "behandlung"]),
            "contains_polite_language": any(phrase in content_lower for phrase in ["bitte", "gerne", "empfehlen", "sollten"]),
            "no_english_mixing": not any(word in content_lower for word in ["the", "and", "or", "with", "for"]),
            "appropriate_formality": any(word in content_lower for word in ["sie", "ihre", "ihnen"])
        }
    
    async def _validate_english_content(self, content: str) -> Dict[str, bool]:
        """Validate English language content."""
        content_lower = content.lower()
        
        return {
            "contains_english_articles": any(word in content_lower for word in ["the", "a", "an"]),
            "contains_medical_terms": any(word in content_lower for word in ["examination", "diagnosis", "treatment", "finding"]),
            "contains_clear_language": any(word in content_lower for word in ["shows", "indicates", "suggests", "reveals"]),
            "no_german_mixing": not any(word in content_lower for word in ["der", "die", "das", "und", "oder"]),
            "patient_friendly": any(phrase in content_lower for phrase in ["this means", "in simple terms", "to explain"])
        }
    
    async def _validate_turkish_content(self, content: str) -> Dict[str, bool]:
        """Validate Turkish language content."""
        content_lower = content.lower()
        
        return {
            "contains_turkish_suffixes": any(suffix in content for suffix in ["lar", "ler", "dir", "tir"]),
            "contains_medical_terms": any(word in content_lower for word in ["muayene", "teşhis", "tedavi", "bulgu"]),
            "contains_polite_forms": any(word in content_lower for word in ["sayın", "değerli", "saygılar"]),
            "no_other_language_mixing": not any(word in content_lower for word in ["the", "der", "le"]),
            "appropriate_medical_turkish": len(content) > 0  # Basic check
        }
    
    async def _validate_french_content(self, content: str) -> Dict[str, bool]:
        """Validate French language content."""
        content_lower = content.lower()
        
        return {
            "contains_french_articles": any(word in content_lower for word in ["le", "la", "les", "un", "une"]),
            "contains_medical_terms": any(word in content_lower for word in ["examen", "diagnostic", "traitement", "résultat"]),
            "contains_polite_language": any(word in content_lower for word in ["veuillez", "s'il vous plaît", "merci"]),
            "no_other_language_mixing": not any(word in content_lower for word in ["the", "der", "ve"]),
            "appropriate_formality": any(word in content_lower for word in ["vous", "votre", "monsieur", "madame"])
        }
    
    async def run_comprehensive_tests(self):
        """Run comprehensive tests on summary generation service."""
        logger.info("🧪 Starting comprehensive summary generation tests")
        
        # Check service health first
        if not await self.check_service_health():
            logger.error("❌ Service health check failed. Please ensure the service is running.")
            return
        
        # Load test data
        await self.load_test_data()
        
        all_results = []
        
        # Test each examination type with different configurations
        for exam_type, samples in self.sample_data.items():
            logger.info(f"\n📋 Testing examination type: {exam_type}")
            
            # Take first 2 samples for testing
            test_samples = samples[:2]
            
            for sample_idx, sample in enumerate(test_samples):
                logger.info(f"\n   Testing sample {sample_idx + 1}/{len(test_samples)}")
                
                # Test with different configurations
                for config in self.test_configurations:
                    logger.info(f"     Configuration: {config['name']}")
                    
                    result = await self.test_summary_generation(
                        sample["transcription"], 
                        config, 
                        exam_type,
                        sample["patient_id"]
                    )
                    
                    # Validate summary quality
                    if result["success"]:
                        quality_validation = await self.validate_summary_quality(result)
                        result["quality_validation"] = quality_validation
                        
                        logger.info(f"     Quality score: {quality_validation['quality_score']}%")
                        
                        # Test retrieval if summary was generated
                        if result.get("summary_id"):
                            retrieved_summary = await self.test_summary_retrieval(result["summary_id"])
                            result["retrieval_success"] = retrieved_summary is not None
                    
                    all_results.append(result)
                    
                    # Small delay between tests
                    await asyncio.sleep(2)
        
        # Save test results
        await self.save_test_results(all_results)
        
        # Generate summary
        await self.generate_test_summary(all_results)
    
    async def save_test_results(self, results: List[Dict[str, Any]]):
        """Save detailed test results."""
        results_file = self.test_data_path / f"summary_generation_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        test_summary = {
            "test_timestamp": datetime.now().isoformat(),
            "total_tests": len(results),
            "successful_tests": len([r for r in results if r["success"]]),
            "failed_tests": len([r for r in results if not r["success"]]),
            "service_base_url": self.base_url,
            "test_configurations": self.test_configurations,
            "detailed_results": results
        }
        
        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(test_summary, f, indent=2, ensure_ascii=False)
        
        logger.info(f"💾 Test results saved to: {results_file}")
    
    async def generate_test_summary(self, results: List[Dict[str, Any]]):
        """Generate and display comprehensive test summary."""
        total_tests = len(results)
        successful_tests = [r for r in results if r["success"]]
        failed_tests = [r for r in results if not r["success"]]
        
        logger.info(f"\n📊 SUMMARY GENERATION TEST SUMMARY")
        logger.info(f"====================================")
        logger.info(f"Total tests: {total_tests}")
        logger.info(f"Successful: {len(successful_tests)} ({len(successful_tests)/total_tests*100:.1f}%)")
        logger.info(f"Failed: {len(failed_tests)} ({len(failed_tests)/total_tests*100:.1f}%)")
        
        if successful_tests:
            avg_processing_time = sum(r["processing_time"] for r in successful_tests) / len(successful_tests)
            avg_compression_ratio = sum(r.get("compression_ratio", 0) for r in successful_tests) / len(successful_tests)
            
            logger.info(f"\nPerformance Metrics:")
            logger.info(f"Average processing time: {avg_processing_time:.2f} seconds")
            logger.info(f"Average compression ratio: {avg_compression_ratio:.2f}")
            
            # Quality scores
            quality_results = [r for r in successful_tests if "quality_validation" in r]
            if quality_results:
                avg_quality = sum(r["quality_validation"]["quality_score"] for r in quality_results) / len(quality_results)
                logger.info(f"Average quality score: {avg_quality:.1f}%")
        
        # Results by language
        logger.info(f"\nResults by Language:")
        language_results = {}
        for result in results:
            lang = result["language"]
            if lang not in language_results:
                language_results[lang] = {"success": 0, "failed": 0}
            
            if result["success"]:
                language_results[lang]["success"] += 1
            else:
                language_results[lang]["failed"] += 1
        
        for lang, counts in language_results.items():
            total = counts["success"] + counts["failed"]
            success_rate = counts["success"] / total * 100 if total > 0 else 0
            logger.info(f"  {lang.upper()}: {counts['success']}/{total} ({success_rate:.1f}%)")
        
        # Results by complexity level
        logger.info(f"\nResults by Complexity Level:")
        complexity_results = {}
        for result in results:
            complexity = result["complexity_level"]
            if complexity not in complexity_results:
                complexity_results[complexity] = {"success": 0, "failed": 0}
            
            if result["success"]:
                complexity_results[complexity]["success"] += 1
            else:
                complexity_results[complexity]["failed"] += 1
        
        for complexity, counts in complexity_results.items():
            total = counts["success"] + counts["failed"]
            success_rate = counts["success"] / total * 100 if total > 0 else 0
            logger.info(f"  {complexity.capitalize()}: {counts['success']}/{total} ({success_rate:.1f}%)")
        
        # Emergency detection results
        emergency_detected = [r for r in successful_tests if r.get("is_urgent")]
        logger.info(f"\nEmergency Detection:")
        logger.info(f"Cases flagged as urgent: {len(emergency_detected)}")
        
        # Show sample summaries
        logger.info(f"\n📝 SAMPLE SUMMARIES")
        logger.info(f"===================")
        
        for lang in ["de", "en", "tr"]:
            lang_results = [r for r in successful_tests if r["language"] == lang and r.get("summary_content")]
            if lang_results:
                sample = lang_results[0]
                summary = sample["summary_content"][:200] + "..." if len(sample["summary_content"]) > 200 else sample["summary_content"]
                logger.info(f"\n{lang.upper()} Summary Sample:")
                logger.info(f"{summary}")


async def main():
    """Main test function."""
    # Configuration
    SERVICE_URL = "http://localhost:8002"  # Adjust if service runs on different port
    TEST_DATA_PATH = "radiology-ai-system/test_data"
    
    logger.info("🚀 Starting Summary Generation Service Tests")
    logger.info(f"Service URL: {SERVICE_URL}")
    logger.info(f"Test data path: {TEST_DATA_PATH}")
    
    tester = SummaryGenerationTester(SERVICE_URL, TEST_DATA_PATH)
    
    try:
        await tester.run_comprehensive_tests()
        logger.info("✅ All summary generation tests completed!")
    except Exception as e:
        logger.error(f"❌ Test execution failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())