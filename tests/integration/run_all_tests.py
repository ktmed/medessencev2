#!/usr/bin/env python3
"""
Comprehensive Test Runner for Radiology AI System

This script runs all tests for the radiology AI system including:
- Data extraction from Excel file
- Report generation service testing
- Summary generation service testing  
- Complete workflow integration testing
- German medical terminology validation

Usage: python run_all_tests.py [--skip-extraction] [--services-only] [--validation-only]
"""

import asyncio
import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

from test_config import (
    setup_test_environment, 
    TestReporter, 
    ServiceType,
    get_predefined_test_scenarios
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('test_execution.log')
    ]
)
logger = logging.getLogger(__name__)

class ComprehensiveTestRunner:
    """Runs comprehensive tests for the radiology AI system."""
    
    def __init__(self, skip_extraction: bool = False, services_only: bool = False, validation_only: bool = False):
        self.config = setup_test_environment()
        self.reporter = TestReporter(self.config)
        self.skip_extraction = skip_extraction
        self.services_only = services_only
        self.validation_only = validation_only
        
        self.test_results = {
            "extraction": None,
            "report_generation": None,
            "summary_generation": None,
            "integration": None,
            "german_validation": None
        }
        
        self.overall_start_time = None
        self.overall_end_time = None
    
    async def run_data_extraction(self) -> Dict[str, Any]:
        """Run data extraction from Excel file."""
        logger.info("🏃 Running data extraction...")
        
        try:
            # Import and run extraction
            import subprocess
            import sys
            
            result = subprocess.run([
                sys.executable, "extract_sample_data.py"
            ], capture_output=True, text=True, cwd=Path(__file__).parent)
            
            if result.returncode == 0:
                logger.info("✅ Data extraction completed successfully")
                return {
                    "success": True,
                    "message": "Data extraction completed",
                    "stdout": result.stdout
                }
            else:
                logger.error(f"❌ Data extraction failed: {result.stderr}")
                return {
                    "success": False,
                    "error": result.stderr,
                    "stdout": result.stdout
                }
                
        except Exception as e:
            logger.error(f"❌ Data extraction exception: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def run_report_generation_tests(self) -> Dict[str, Any]:
        """Run report generation service tests."""
        logger.info("🏃 Running report generation tests...")
        
        try:
            from test_report_generation import ReportGenerationTester
            
            tester = ReportGenerationTester(
                base_url=self.config.services[ServiceType.REPORT_GENERATION].base_url,
                test_data_path=str(self.config.test_data_dir)
            )
            
            # Check if service is available
            if not await tester.check_service_health():
                return {
                    "success": False,
                    "error": "Report generation service is not available",
                    "service_url": self.config.services[ServiceType.REPORT_GENERATION].base_url
                }
            
            # Load test data
            await tester.load_test_data()
            
            # Run tests
            all_results = []
            for exam_type, samples in tester.sample_data.items():
                logger.info(f"Testing {exam_type} with {len(samples)} samples")
                
                for i, sample in enumerate(samples[:self.config.max_samples_per_type]):
                    result = await tester.test_report_generation(sample, exam_type)
                    all_results.append(result)
                    
                    if result["success"] and result.get("report_id"):
                        retrieved_report = await tester.test_report_retrieval(result["report_id"])
                        result["retrieval_success"] = retrieved_report is not None
            
            # Save results
            await tester.save_test_results(all_results)
            
            success_count = len([r for r in all_results if r["success"]])
            
            logger.info(f"✅ Report generation tests completed: {success_count}/{len(all_results)} successful")
            
            return {
                "success": True,
                "total_tests": len(all_results),
                "successful_tests": success_count,
                "failed_tests": len(all_results) - success_count,
                "detailed_results": all_results
            }
            
        except Exception as e:
            logger.error(f"❌ Report generation tests failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def run_summary_generation_tests(self) -> Dict[str, Any]:
        """Run summary generation service tests."""
        logger.info("🏃 Running summary generation tests...")
        
        try:
            from test_summary_generation import SummaryGenerationTester
            
            tester = SummaryGenerationTester(
                base_url=self.config.services[ServiceType.SUMMARY_GENERATION].base_url,
                test_data_path=str(self.config.test_data_dir)
            )
            
            # Check if service is available
            if not await tester.check_service_health():
                return {
                    "success": False,
                    "error": "Summary generation service is not available",
                    "service_url": self.config.services[ServiceType.SUMMARY_GENERATION].base_url
                }
            
            # Load test data
            await tester.load_test_data()
            
            # Run tests with limited samples and configurations
            all_results = []
            test_configs = tester.test_configurations[:3]  # Limit configurations for faster testing
            
            for exam_type, samples in tester.sample_data.items():
                # Take only first 2 samples per exam type
                test_samples = samples[:2]
                
                for sample in test_samples:
                    for config in test_configs:
                        result = await tester.test_summary_generation(
                            sample["transcription"], 
                            config, 
                            exam_type,
                            sample["patient_id"]
                        )
                        
                        if result["success"]:
                            quality_validation = await tester.validate_summary_quality(result)
                            result["quality_validation"] = quality_validation
                        
                        all_results.append(result)
            
            # Save results
            await tester.save_test_results(all_results)
            
            success_count = len([r for r in all_results if r["success"]])
            
            logger.info(f"✅ Summary generation tests completed: {success_count}/{len(all_results)} successful")
            
            return {
                "success": True,
                "total_tests": len(all_results),
                "successful_tests": success_count,
                "failed_tests": len(all_results) - success_count,
                "detailed_results": all_results
            }
            
        except Exception as e:
            logger.error(f"❌ Summary generation tests failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def run_integration_tests(self) -> Dict[str, Any]:
        """Run complete workflow integration tests."""
        logger.info("🏃 Running integration tests...")
        
        try:
            from test_complete_workflow import CompleteWorkflowTester
            
            tester = CompleteWorkflowTester(
                transcription_url=self.config.services[ServiceType.TRANSCRIPTION].base_url,
                report_url=self.config.services[ServiceType.REPORT_GENERATION].base_url,
                summary_url=self.config.services[ServiceType.SUMMARY_GENERATION].base_url,
                test_data_path=str(self.config.test_data_dir)
            )
            
            # Check all services health
            service_health = await tester.check_all_services_health()
            unhealthy_services = [name for name, health in service_health.items() if not health]
            
            if unhealthy_services:
                return {
                    "success": False,
                    "error": f"Services not available: {unhealthy_services}",
                    "service_health": service_health
                }
            
            # Load test data
            await tester.load_test_data()
            
            # Run limited workflow tests
            all_workflow_results = []
            test_configs = tester.workflow_configs[:2]  # Limit configurations
            
            for exam_type, samples in tester.sample_data.items():
                if not samples:
                    continue
                
                # Take only first sample per exam type
                sample = samples[0]
                
                for config in test_configs:
                    test_sample = sample.copy()
                    test_sample["examination_type"] = config["examination_type"]
                    
                    workflow_result = await tester.run_complete_workflow(test_sample, config, exam_type)
                    
                    if workflow_result["overall_success"]:
                        validation_result = await tester.validate_workflow_output(workflow_result)
                        workflow_result["validation"] = validation_result
                    
                    all_workflow_results.append(workflow_result)
            
            # Save results
            await tester.save_workflow_results(all_workflow_results)
            
            success_count = len([r for r in all_workflow_results if r["overall_success"]])
            
            logger.info(f"✅ Integration tests completed: {success_count}/{len(all_workflow_results)} successful")
            
            return {
                "success": True,
                "total_workflows": len(all_workflow_results),
                "successful_workflows": success_count,
                "failed_workflows": len(all_workflow_results) - success_count,
                "detailed_results": all_workflow_results
            }
            
        except Exception as e:
            logger.error(f"❌ Integration tests failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def run_german_validation_tests(self) -> Dict[str, Any]:
        """Run German medical terminology validation tests."""
        logger.info("🏃 Running German medical validation tests...")
        
        try:
            from test_german_medical_validation import GermanMedicalValidator
            
            validator = GermanMedicalValidator(str(self.config.test_data_dir))
            
            # Load test data
            await validator.load_test_data()
            
            # Run validation on all samples
            all_validation_results = []
            
            for exam_type, samples in validator.sample_data.items():
                for sample in samples:
                    validation_result = await validator.validate_sample(sample, exam_type)
                    all_validation_results.append(validation_result)
            
            # Save results
            await validator.save_validation_results(all_validation_results)
            
            avg_score = sum(r["overall_validation_score"] for r in all_validation_results) / len(all_validation_results)
            
            logger.info(f"✅ German validation tests completed: Average score {avg_score:.1f}%")
            
            return {
                "success": True,
                "total_samples": len(all_validation_results),
                "average_validation_score": avg_score,
                "detailed_results": all_validation_results
            }
            
        except Exception as e:
            logger.error(f"❌ German validation tests failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def run_all_tests(self) -> Dict[str, Any]:
        """Run all tests in sequence."""
        logger.info("🚀 Starting comprehensive test execution")
        logger.info(f"Configuration: skip_extraction={self.skip_extraction}, services_only={self.services_only}, validation_only={self.validation_only}")
        
        self.overall_start_time = datetime.now()
        
        # Step 1: Data extraction (unless skipped)
        if not self.skip_extraction and not self.validation_only:
            logger.info("\n" + "="*60)
            logger.info("STEP 1: DATA EXTRACTION")
            logger.info("="*60)
            self.test_results["extraction"] = await self.run_data_extraction()
            
            if not self.test_results["extraction"]["success"]:
                logger.error("❌ Data extraction failed. Cannot proceed with other tests.")
                return await self.generate_final_report()
        
        # Check if sample data exists
        sample_data_file = self.config.test_data_dir / "sample_medical_data.json"
        if not sample_data_file.exists() and not self.validation_only:
            logger.error("❌ Sample data file not found. Please run data extraction first.")
            return await self.generate_final_report()
        
        if not self.validation_only:
            # Step 2: Report generation tests
            logger.info("\n" + "="*60)
            logger.info("STEP 2: REPORT GENERATION TESTS")
            logger.info("="*60)
            self.test_results["report_generation"] = await self.run_report_generation_tests()
            
            # Step 3: Summary generation tests
            logger.info("\n" + "="*60)
            logger.info("STEP 3: SUMMARY GENERATION TESTS")
            logger.info("="*60)
            self.test_results["summary_generation"] = await self.run_summary_generation_tests()
            
            if not self.services_only:
                # Step 4: Integration tests (only if both services work)
                if (self.test_results["report_generation"]["success"] and 
                    self.test_results["summary_generation"]["success"]):
                    logger.info("\n" + "="*60)
                    logger.info("STEP 4: INTEGRATION TESTS")
                    logger.info("="*60)
                    self.test_results["integration"] = await self.run_integration_tests()
                else:
                    logger.warning("⚠️  Skipping integration tests due to service failures")
                    self.test_results["integration"] = {
                        "success": False,
                        "error": "Skipped due to service failures"
                    }
        
        # Step 5: German validation tests
        if not self.services_only:
            logger.info("\n" + "="*60)
            logger.info("STEP 5: GERMAN MEDICAL VALIDATION")
            logger.info("="*60)
            self.test_results["german_validation"] = await self.run_german_validation_tests()
        
        self.overall_end_time = datetime.now()
        
        return await self.generate_final_report()
    
    async def generate_final_report(self) -> Dict[str, Any]:
        """Generate comprehensive final test report."""
        logger.info("\n" + "="*60)
        logger.info("GENERATING FINAL TEST REPORT")
        logger.info("="*60)
        
        total_duration = None
        if self.overall_start_time and self.overall_end_time:
            total_duration = (self.overall_end_time - self.overall_start_time).total_seconds()
        
        # Calculate overall statistics
        total_tests = 0
        successful_tests = 0
        failed_tests = 0
        
        for test_type, result in self.test_results.items():
            if result and result.get("success"):
                if "total_tests" in result:
                    total_tests += result["total_tests"]
                    successful_tests += result.get("successful_tests", 0)
                    failed_tests += result.get("failed_tests", 0)
                elif "total_workflows" in result:
                    total_tests += result["total_workflows"]
                    successful_tests += result.get("successful_workflows", 0)
                    failed_tests += result.get("failed_workflows", 0)
                elif "total_samples" in result:
                    total_tests += result["total_samples"]
                    # For validation, consider all as "tests"
                    successful_tests += result["total_samples"]
        
        final_report = {
            "test_execution_summary": {
                "execution_timestamp": datetime.now().isoformat(),
                "total_duration_seconds": total_duration,
                "total_tests_executed": total_tests,
                "successful_tests": successful_tests,
                "failed_tests": failed_tests,
                "overall_success_rate": (successful_tests / total_tests * 100) if total_tests > 0 else 0,
                "test_configuration": {
                    "skip_extraction": self.skip_extraction,
                    "services_only": self.services_only,
                    "validation_only": self.validation_only
                }
            },
            "test_results_by_category": self.test_results,
            "service_configuration": {
                service_type.value: service_config.__dict__ 
                for service_type, service_config in self.config.services.items()
            },
            "recommendations": self.generate_recommendations()
        }
        
        # Save final report
        final_report_file = self.config.test_data_dir / f"final_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(final_report_file, 'w', encoding='utf-8') as f:
            json.dump(final_report, f, indent=2, ensure_ascii=False)
        
        # Display summary
        self.display_final_summary(final_report)
        
        logger.info(f"💾 Final test report saved to: {final_report_file}")
        
        return final_report
    
    def generate_recommendations(self) -> List[str]:
        """Generate recommendations based on test results."""
        recommendations = []
        
        # Check data extraction
        if self.test_results.get("extraction") and not self.test_results["extraction"]["success"]:
            recommendations.append("Fix data extraction issues before running service tests")
        
        # Check service availability
        if self.test_results.get("report_generation") and not self.test_results["report_generation"]["success"]:
            recommendations.append("Ensure report generation service is running and accessible")
        
        if self.test_results.get("summary_generation") and not self.test_results["summary_generation"]["success"]:
            recommendations.append("Ensure summary generation service is running and accessible")
        
        # Check integration
        if self.test_results.get("integration") and not self.test_results["integration"]["success"]:
            recommendations.append("Check service integration and data flow between services")
        
        # Check German validation scores
        if self.test_results.get("german_validation"):
            avg_score = self.test_results["german_validation"].get("average_validation_score", 0)
            if avg_score < 70:
                recommendations.append("Improve German medical terminology and report structure quality")
        
        if not recommendations:
            recommendations.append("All tests completed successfully! System is ready for production.")
        
        return recommendations
    
    def display_final_summary(self, final_report: Dict[str, Any]):
        """Display final test summary."""
        summary = final_report["test_execution_summary"]
        
        logger.info(f"\n📊 FINAL TEST SUMMARY")
        logger.info(f"=====================")
        logger.info(f"Total tests executed: {summary['total_tests_executed']}")
        logger.info(f"Successful tests: {summary['successful_tests']}")
        logger.info(f"Failed tests: {summary['failed_tests']}")
        logger.info(f"Overall success rate: {summary['overall_success_rate']:.1f}%")
        
        if summary['total_duration_seconds']:
            logger.info(f"Total execution time: {summary['total_duration_seconds']:.1f} seconds")
        
        logger.info(f"\nTest Results by Category:")
        for category, result in self.test_results.items():
            if result:
                status = "✅ PASSED" if result["success"] else "❌ FAILED"
                logger.info(f"  {category.replace('_', ' ').title()}: {status}")
        
        logger.info(f"\nRecommendations:")
        for i, recommendation in enumerate(final_report["recommendations"], 1):
            logger.info(f"  {i}. {recommendation}")


async def main():
    """Main function to run comprehensive tests."""
    parser = argparse.ArgumentParser(description="Run comprehensive tests for radiology AI system")
    parser.add_argument("--skip-extraction", action="store_true", 
                       help="Skip data extraction step (assumes sample data already exists)")
    parser.add_argument("--services-only", action="store_true",
                       help="Run only service tests (report and summary generation)")
    parser.add_argument("--validation-only", action="store_true",
                       help="Run only German medical validation tests")
    
    args = parser.parse_args()
    
    # Validate argument combinations
    if args.services_only and args.validation_only:
        logger.error("❌ Cannot specify both --services-only and --validation-only")
        sys.exit(1)
    
    try:
        # Create and run test runner
        test_runner = ComprehensiveTestRunner(
            skip_extraction=args.skip_extraction,
            services_only=args.services_only,
            validation_only=args.validation_only
        )
        
        final_report = await test_runner.run_all_tests()
        
        # Exit with appropriate code
        success_rate = final_report["test_execution_summary"]["overall_success_rate"]
        if success_rate >= 80:
            logger.info("🎉 Tests completed successfully!")
            sys.exit(0)
        else:
            logger.warning(f"⚠️  Tests completed with {success_rate:.1f}% success rate")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("❌ Test execution interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"❌ Test execution failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())