#!/usr/bin/env node
/**
 * Test German Medical Transcription and Report Generation
 * Tests WebSpeech API integration and Multi-LLM system
 */

const { BACKEND_URL } = require('./test_connectivity');

const GERMAN_MEDICAL_TEST_CASES = [
  {
    id: 'mammography_normal',
    text: 'Mammographie-Untersuchung der Patientin zeigt beidseits unauffällige Befunde ohne Hinweise auf Malignität',
    modality: 'mammography',
    expectedTerms: ['mammographie', 'unauffällig', 'befunde', 'malignität'],
    expectedICDCodes: ['Z12.31'], // Mammography screening
    category: 'screening'
  },
  {
    id: 'ultrasound_liver',
    text: 'Sonographie Abdomen mit Nachweis einer echoarmen Läsion in der Leber Segment vier rechts',
    modality: 'ultrasound', 
    expectedTerms: ['sonographie', 'abdomen', 'läsion', 'leber'],
    expectedICDCodes: ['K76.9'], // Liver disease unspecified
    category: 'diagnostic'
  },
  {
    id: 'ct_thorax',
    text: 'Computertomographie Thorax ohne Kontrastmittel zeigt regelrechte Lungenbelüftung ohne Infiltrate',
    modality: 'ct_scan',
    expectedTerms: ['computertomographie', 'thorax', 'kontrastmittel', 'lungenbelüftung'],
    expectedICDCodes: ['Z01.6'], // Radiological examination
    category: 'diagnostic'
  },
  {
    id: 'mrt_brain',
    text: 'Magnetresonanztomographie Schädel nativ zeigt altersentsprechende Befunde ohne pathologische Veränderungen',
    modality: 'mri',
    expectedTerms: ['magnetresonanztomographie', 'schädel', 'altersentsprechende', 'pathologische'],
    expectedICDCodes: ['Z01.0'], // Examination of eyes and vision
    category: 'diagnostic'
  },
  {
    id: 'xray_chest',
    text: 'Röntgen Thorax in zwei Ebenen mit unauffälligen Lungenbefunden und regelrechter Herzgröße',
    modality: 'xray',
    expectedTerms: ['röntgen', 'thorax', 'ebenen', 'lungenbefunden', 'herzgröße'],
    expectedICDCodes: ['Z01.6'], // Radiological examination
    category: 'diagnostic'
  }
];

async function testGermanMedical() {
  console.log('🇩🇪 Testing German Medical Transcription & Report Generation');
  console.log('============================================================');
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Test Cases: ${GERMAN_MEDICAL_TEST_CASES.length}`);
  console.log('');

  const results = {
    timestamp: new Date().toISOString(),
    test_cases: [],
    summary: {
      total: GERMAN_MEDICAL_TEST_CASES.length,
      passed: 0,
      failed: 0,
      errors: 0
    }
  };

  for (const testCase of GERMAN_MEDICAL_TEST_CASES) {
    console.log(`🧪 Testing: ${testCase.id}`);
    console.log(`   Text: "${testCase.text.substring(0, 60)}..."`);
    console.log(`   Modality: ${testCase.modality}`);

    const testResult = {
      id: testCase.id,
      status: 'pending',
      details: {},
      performance: {},
      validation: {}
    };

    try {
      const startTime = Date.now();

      // Test 1: Report Generation
      console.log('   📝 Testing report generation...');
      const reportResponse = await fetch(`${BACKEND_URL}/api/generate-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://medessencev3-test-kerem-tomaks-projects.vercel.app'
        },
        body: JSON.stringify({
          transcriptionText: testCase.text,
          language: 'de',
          modality: testCase.modality,
          processingMode: 'cloud' // Test cloud LLMs first
        })
      });

      const reportTime = Date.now() - startTime;
      testResult.performance.report_generation_ms = reportTime;

      if (!reportResponse.ok) {
        throw new Error(`Report generation failed: ${reportResponse.status} ${reportResponse.statusText}`);
      }

      const reportData = await reportResponse.json();
      testResult.details.report = reportData;

      console.log(`   ✅ Report generated in ${reportTime}ms`);

      // Test 2: Content Validation
      console.log('   🔍 Validating German medical content...');
      
      const reportText = JSON.stringify(reportData).toLowerCase();
      
      // Check for expected German medical terms
      const foundTerms = testCase.expectedTerms.filter(term => 
        reportText.includes(term.toLowerCase())
      );
      
      testResult.validation.expected_terms = testCase.expectedTerms.length;
      testResult.validation.found_terms = foundTerms.length;
      testResult.validation.term_accuracy = foundTerms.length / testCase.expectedTerms.length;

      console.log(`   📊 Medical terms: ${foundTerms.length}/${testCase.expectedTerms.length} found`);

      // Test 3: ICD Code Suggestions (if available)
      if (reportData.icd_suggestions || reportData.icdCodes) {
        const icdCodes = reportData.icd_suggestions || reportData.icdCodes || [];
        testResult.validation.icd_codes_suggested = icdCodes.length;
        
        if (icdCodes.length > 0) {
          console.log(`   🏥 ICD codes suggested: ${icdCodes.length}`);
          icdCodes.slice(0, 3).forEach(code => {
            const codeStr = typeof code === 'string' ? code : code.code;
            const desc = typeof code === 'object' ? code.description : '';
            console.log(`      ${codeStr}: ${desc}`);
          });
        }
      }

      // Test 4: Report Structure Validation
      const hasGermanStructure = (
        reportText.includes('befund') || 
        reportText.includes('beurteilung') || 
        reportText.includes('empfehlung') ||
        reportText.includes('diagnose')
      );

      testResult.validation.german_structure = hasGermanStructure;
      console.log(`   📋 German report structure: ${hasGermanStructure ? 'Yes' : 'No'}`);

      // Test 5: Performance Validation
      const performancePass = reportTime < 16000; // <16 seconds
      testResult.validation.performance_pass = performancePass;
      console.log(`   ⏱️ Performance: ${performancePass ? 'Pass' : 'Fail'} (${reportTime}ms)`);

      // Overall test assessment
      const passThreshold = 0.6; // 60% of validations must pass
      const validationScores = [
        testResult.validation.term_accuracy > 0.5,
        testResult.validation.german_structure,
        testResult.validation.performance_pass
      ];
      
      const passCount = validationScores.filter(Boolean).length;
      const passRate = passCount / validationScores.length;

      if (passRate >= passThreshold) {
        testResult.status = 'pass';
        results.summary.passed++;
        console.log(`   ✅ Test PASSED (${Math.round(passRate * 100)}% validation success)`);
      } else {
        testResult.status = 'fail';
        results.summary.failed++;
        console.log(`   ❌ Test FAILED (${Math.round(passRate * 100)}% validation success)`);
      }

    } catch (error) {
      testResult.status = 'error';
      testResult.details.error = error.message;
      results.summary.errors++;
      console.log(`   💥 Test ERROR: ${error.message}`);
    }

    results.test_cases.push(testResult);
    console.log('');
  }

  // Multi-LLM Fallback Test
  console.log('🔄 Testing Multi-LLM Fallback Chain');
  console.log('------------------------------------');
  
  const fallbackTest = {
    id: 'multi_llm_fallback',
    status: 'pending',
    details: {}
  };

  try {
    // Test fallback by trying local processing mode
    console.log('   🧠 Testing local LLM fallback...');
    
    const fallbackResponse = await fetch(`${BACKEND_URL}/api/generate-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://medessencev3-test-kerem-tomaks-projects.vercel.app'
      },
      body: JSON.stringify({
        transcriptionText: GERMAN_MEDICAL_TEST_CASES[0].text,
        language: 'de',
        processingMode: 'local' // Force local Ollama
      })
    });

    if (fallbackResponse.ok) {
      const fallbackData = await fallbackResponse.json();
      fallbackTest.status = 'pass';
      fallbackTest.details = { provider: 'local', response_received: true };
      console.log('   ✅ Local LLM fallback working');
    } else {
      fallbackTest.status = 'partial';
      fallbackTest.details = { error: `Local LLM returned ${fallbackResponse.status}` };
      console.log('   ⚠️ Local LLM fallback not available');
    }
  } catch (error) {
    fallbackTest.status = 'error';
    fallbackTest.details = { error: error.message };
    console.log(`   ❌ Fallback test failed: ${error.message}`);
  }

  results.fallback_test = fallbackTest;
  console.log('');

  // Final Summary
  console.log('📊 German Medical Testing Summary');
  console.log('=================================');
  
  const successRate = Math.round((results.summary.passed / results.summary.total) * 100);
  
  console.log(`Total Tests: ${results.summary.total}`);
  console.log(`Passed: ${results.summary.passed} ✅`);
  console.log(`Failed: ${results.summary.failed} ❌`);
  console.log(`Errors: ${results.summary.errors} 💥`);
  console.log(`Success Rate: ${successRate}%`);
  console.log('');

  // Detailed Performance Stats
  const performanceTimes = results.test_cases
    .filter(tc => tc.performance.report_generation_ms)
    .map(tc => tc.performance.report_generation_ms);

  if (performanceTimes.length > 0) {
    const avgTime = Math.round(performanceTimes.reduce((a, b) => a + b, 0) / performanceTimes.length);
    const maxTime = Math.max(...performanceTimes);
    const minTime = Math.min(...performanceTimes);

    console.log('⏱️ Performance Statistics:');
    console.log(`   Average Response Time: ${avgTime}ms`);
    console.log(`   Fastest Response: ${minTime}ms`);
    console.log(`   Slowest Response: ${maxTime}ms`);
    console.log(`   Target: <16000ms`);
    console.log('');
  }

  // Recommendations
  console.log('💡 Recommendations:');
  if (successRate >= 80) {
    console.log('   🎉 German medical system performing well!');
    console.log('   ✅ Ready for user acceptance testing');
  } else if (successRate >= 60) {
    console.log('   ⚠️ Some issues detected - review failed tests');
    console.log('   🔧 Consider tuning medical term recognition');
  } else {
    console.log('   🚨 Significant issues detected');
    console.log('   🔧 Review LLM configurations and medical dictionaries');
    console.log('   📞 Check API connectivity and fallback chains');
  }

  console.log('');
  console.log('💾 Saving detailed results...');
  console.log(JSON.stringify(results, null, 2));

  return results;
}

// Execute tests if run directly
if (require.main === module) {
  testGermanMedical()
    .then(results => {
      const successRate = results.summary.passed / results.summary.total;
      process.exit(successRate >= 0.6 ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 German medical testing failed:', error);
      process.exit(1);
    });
}

module.exports = { testGermanMedical, GERMAN_MEDICAL_TEST_CASES };