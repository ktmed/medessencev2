#!/usr/bin/env node
/**
 * Comprehensive Test Suite for MedEssenceAI
 * Runs all tests in sequence and generates final report
 */

const { testConnectivity } = require('./test_connectivity');
const { testGermanMedical } = require('./test_german_medical');
const fs = require('fs').promises;
const path = require('path');

async function runAllTests() {
  console.log('🚀 MedEssenceAI Comprehensive Test Suite');
  console.log('========================================');
  console.log('Target: medessencev3-test.vercel.app + Heroku Backend');
  console.log(`Start Time: ${new Date().toISOString()}`);
  console.log('');

  const testSuite = {
    start_time: new Date().toISOString(),
    target: {
      frontend: 'https://medessencev3-test-kerem-tomaks-projects.vercel.app',
      backend: 'https://medessence-backend.herokuapp.com'
    },
    tests: {},
    summary: {
      total_test_groups: 0,
      passed_test_groups: 0,
      total_individual_tests: 0,
      passed_individual_tests: 0,
      overall_success_rate: 0,
      ready_for_production: false
    }
  };

  // Test 1: Infrastructure Connectivity
  console.log('🏗️ PHASE 1: Infrastructure Testing');
  console.log('==================================');
  try {
    const connectivityResults = await testConnectivity();
    testSuite.tests.connectivity = connectivityResults;
    
    const connectivitySuccess = connectivityResults.summary.passed_tests === connectivityResults.summary.total_tests;
    if (connectivitySuccess) {
      testSuite.summary.passed_test_groups++;
      console.log('✅ Infrastructure tests PASSED - Proceeding to functional tests');
    } else {
      console.log('❌ Infrastructure tests FAILED - Cannot proceed to functional tests');
      console.log('🔧 Fix connectivity issues before continuing');
      
      // Save results and exit early
      await saveTestResults(testSuite);
      return testSuite;
    }
    testSuite.summary.total_test_groups++;
  } catch (error) {
    console.error('💥 Infrastructure testing failed:', error.message);
    testSuite.tests.connectivity = { error: error.message, status: 'error' };
    testSuite.summary.total_test_groups++;
    await saveTestResults(testSuite);
    return testSuite;
  }

  console.log('');

  // Test 2: German Medical Functionality
  console.log('🇩🇪 PHASE 2: German Medical Testing');
  console.log('===================================');
  try {
    const medicalResults = await testGermanMedical();
    testSuite.tests.german_medical = medicalResults;
    
    const medicalSuccess = medicalResults.summary.passed >= (medicalResults.summary.total * 0.8); // 80% pass rate
    if (medicalSuccess) {
      testSuite.summary.passed_test_groups++;
      console.log('✅ German medical tests PASSED');
    } else {
      console.log('❌ German medical tests FAILED');
    }
    testSuite.summary.total_test_groups++;
    testSuite.summary.total_individual_tests += medicalResults.summary.total;
    testSuite.summary.passed_individual_tests += medicalResults.summary.passed;
  } catch (error) {
    console.error('💥 German medical testing failed:', error.message);
    testSuite.tests.german_medical = { error: error.message, status: 'error' };
    testSuite.summary.total_test_groups++;
  }

  console.log('');

  // Test 3: Performance Validation
  console.log('⚡ PHASE 3: Performance Testing');
  console.log('===============================');
  const performanceResults = await testPerformance();
  testSuite.tests.performance = performanceResults;
  
  if (performanceResults.status === 'pass') {
    testSuite.summary.passed_test_groups++;
  }
  testSuite.summary.total_test_groups++;

  console.log('');

  // Calculate final metrics
  testSuite.end_time = new Date().toISOString();
  testSuite.summary.overall_success_rate = Math.round(
    (testSuite.summary.passed_test_groups / testSuite.summary.total_test_groups) * 100
  );

  // Determine production readiness
  const criticalTestsPassed = (
    testSuite.tests.connectivity?.summary?.passed_tests === testSuite.tests.connectivity?.summary?.total_tests &&
    testSuite.tests.german_medical?.summary?.passed >= (testSuite.tests.german_medical?.summary?.total * 0.6) // 60% minimum
  );

  testSuite.summary.ready_for_production = criticalTestsPassed && testSuite.summary.overall_success_rate >= 70;

  // Final Report
  console.log('📊 FINAL TEST REPORT');
  console.log('====================');
  console.log(`Overall Success Rate: ${testSuite.summary.overall_success_rate}%`);
  console.log(`Test Groups Passed: ${testSuite.summary.passed_test_groups}/${testSuite.summary.total_test_groups}`);
  
  if (testSuite.summary.total_individual_tests > 0) {
    const individualSuccessRate = Math.round(
      (testSuite.summary.passed_individual_tests / testSuite.summary.total_individual_tests) * 100
    );
    console.log(`Individual Tests Passed: ${testSuite.summary.passed_individual_tests}/${testSuite.summary.total_individual_tests} (${individualSuccessRate}%)`);
  }

  console.log('');
  console.log('🎯 Production Readiness Assessment:');
  if (testSuite.summary.ready_for_production) {
    console.log('✅ READY FOR PRODUCTION');
    console.log('   🎉 All critical systems operational');
    console.log('   🚀 Deploy to production with confidence');
    console.log('   📋 Consider user acceptance testing');
  } else {
    console.log('⚠️ NOT READY FOR PRODUCTION');
    console.log('   🔧 Critical issues need resolution:');
    
    if (!testSuite.tests.connectivity?.summary || testSuite.tests.connectivity.summary.passed_tests < testSuite.tests.connectivity.summary.total_tests) {
      console.log('     • Fix frontend-backend connectivity');
    }
    
    if (!testSuite.tests.german_medical?.summary || testSuite.tests.german_medical.summary.passed < (testSuite.tests.german_medical.summary.total * 0.6)) {
      console.log('     • Improve German medical transcription accuracy');
    }
    
    if (testSuite.summary.overall_success_rate < 70) {
      console.log('     • Address performance and functionality issues');
    }
  }

  // Save detailed results
  await saveTestResults(testSuite);

  console.log('');
  console.log(`💾 Test results saved to: test-results-${Date.now()}.json`);
  console.log('🏁 Testing complete!');

  return testSuite;
}

async function testPerformance() {
  console.log('   ⏱️ Testing response times...');
  
  const performanceResults = {
    status: 'pending',
    metrics: {},
    thresholds: {
      frontend_load: 3000, // 3s
      backend_health: 2000, // 2s
      report_generation: 16000 // 16s
    }
  };

  try {
    // Frontend load time
    const frontendStart = Date.now();
    const frontendResponse = await fetch('https://medessencev3-test-kerem-tomaks-projects.vercel.app');
    const frontendTime = Date.now() - frontendStart;
    performanceResults.metrics.frontend_load_ms = frontendTime;

    // Backend health check time
    const backendStart = Date.now();
    const backendResponse = await fetch('https://medessence-backend.herokuapp.com/api/health');
    const backendTime = Date.now() - backendStart;
    performanceResults.metrics.backend_health_ms = backendTime;

    // Report generation time (using cached result if available)
    if (global.lastReportGenerationTime) {
      performanceResults.metrics.report_generation_ms = global.lastReportGenerationTime;
    }

    // Evaluate performance
    const frontendPass = frontendTime <= performanceResults.thresholds.frontend_load;
    const backendPass = backendTime <= performanceResults.thresholds.backend_health;
    const reportPass = !performanceResults.metrics.report_generation_ms || 
                      performanceResults.metrics.report_generation_ms <= performanceResults.thresholds.report_generation;

    performanceResults.status = (frontendPass && backendPass && reportPass) ? 'pass' : 'fail';

    console.log(`   📈 Frontend Load: ${frontendTime}ms (${frontendPass ? 'PASS' : 'FAIL'})`);
    console.log(`   📈 Backend Health: ${backendTime}ms (${backendPass ? 'PASS' : 'FAIL'})`);
    
    if (performanceResults.metrics.report_generation_ms) {
      console.log(`   📈 Report Generation: ${performanceResults.metrics.report_generation_ms}ms (${reportPass ? 'PASS' : 'FAIL'})`);
    }

  } catch (error) {
    performanceResults.status = 'error';
    performanceResults.error = error.message;
    console.log(`   💥 Performance test error: ${error.message}`);
  }

  return performanceResults;
}

async function saveTestResults(testSuite) {
  try {
    const timestamp = Date.now();
    const filename = `test-results-${timestamp}.json`;
    const filepath = path.join(__dirname, filename);
    
    await fs.writeFile(filepath, JSON.stringify(testSuite, null, 2));
    
    // Also save a latest-results.json for easy access
    const latestFilepath = path.join(__dirname, 'latest-results.json');
    await fs.writeFile(latestFilepath, JSON.stringify(testSuite, null, 2));
    
    console.log(`💾 Test results saved to: ${filename}`);
  } catch (error) {
    console.error('⚠️ Could not save test results:', error.message);
  }
}

// Execute if run directly
if (require.main === module) {
  runAllTests()
    .then(results => {
      process.exit(results.summary.ready_for_production ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test suite execution failed:', error);
      process.exit(1);
    });
}

module.exports = { runAllTests };