#!/usr/bin/env node

/**
 * Test script for ICD code integration with ontology service
 * Tests the complete flow from frontend API to ontology service
 */

const testICDIntegration = async () => {
  console.log('🧪 Testing ICD Code Integration with Ontology Service\n');
  console.log('=' .repeat(60));
  
  const testCases = [
    {
      name: 'Breast Cancer with Metastases',
      text: 'Mammographie zeigt Mammakarzinom links mit Metastasen in Leber und Knochen. BI-RADS 6.',
      expectedCodes: ['C50', 'C79', 'C22']
    },
    {
      name: 'Normal Mammography',
      text: 'Mammographie beidseits unauffällig. Keine Hinweise auf Malignität. BI-RADS 1.',
      expectedCodes: ['Z12', 'R']
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n📋 Test Case: ${testCase.name}`);
    console.log('-'.repeat(40));
    
    try {
      // Test the frontend API endpoint
      console.log('1️⃣ Testing Frontend API (/api/generate-icd)...');
      const frontendResponse = await fetch('http://localhost:3010/api/generate-icd', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportId: `test-${Date.now()}`,
          reportContent: testCase.text,
          language: 'de',
          codeSystem: 'ICD-10-GM'
        })
      });
      
      if (!frontendResponse.ok) {
        throw new Error(`Frontend API returned ${frontendResponse.status}`);
      }
      
      const icdResult = await frontendResponse.json();
      console.log('✅ Frontend API Response:');
      console.log(`   - Total codes: ${icdResult.codes?.length || 0}`);
      console.log(`   - Provider: ${icdResult.provider}`);
      console.log(`   - Confidence: ${icdResult.confidence}`);
      
      // Check if expected codes are present
      if (icdResult.codes && icdResult.codes.length > 0) {
        console.log('\n   📌 ICD Codes Found:');
        icdResult.codes.slice(0, 5).forEach(code => {
          console.log(`      ${code.code}: ${code.description.substring(0, 50)}...`);
          console.log(`         Priority: ${code.priority}, Confidence: ${code.confidence}`);
        });
        
        // Verify expected codes
        const foundCodes = icdResult.codes.map(c => c.code);
        const matchedExpected = testCase.expectedCodes.filter(expected => 
          foundCodes.some(code => code.startsWith(expected))
        );
        
        if (matchedExpected.length > 0) {
          console.log(`\n   ✅ Found expected codes: ${matchedExpected.join(', ')}`);
        } else {
          console.log(`\n   ⚠️  Expected codes not found: ${testCase.expectedCodes.join(', ')}`);
        }
      }
      
      // Test direct ontology service
      console.log('\n2️⃣ Testing Direct Ontology Service...');
      const ontologyResponse = await fetch('http://localhost:8001/api/enhance-transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcription_text: testCase.text,
          modality: 'mammographie'
        })
      });
      
      if (!ontologyResponse.ok) {
        throw new Error(`Ontology service returned ${ontologyResponse.status}`);
      }
      
      const ontologyData = await ontologyResponse.json();
      console.log('✅ Ontology Service Response:');
      console.log(`   - ICD suggestions: ${ontologyData.data?.suggested_icd_codes?.length || 0}`);
      console.log(`   - Findings: ${ontologyData.data?.extracted_findings?.length || 0}`);
      console.log(`   - Quality score: ${ontologyData.data?.quality_score}`);
      
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 Integration Test Complete\n');
  
  // Test statistics endpoint
  console.log('📊 Fetching Ontology Statistics...');
  try {
    const statsResponse = await fetch('http://localhost:8001/api/statistics');
    const stats = await statsResponse.json();
    
    if (stats.success) {
      console.log('✅ Database Statistics:');
      console.log(`   - ICD codes: ${stats.data.database_stats.icd_count}`);
      console.log(`   - Medical cases: ${stats.data.database_stats.total_cases}`);
      console.log(`   - Top modalities:`);
      stats.data.database_stats.top_modalities.slice(0, 3).forEach(m => {
        console.log(`      • ${m.modality}: ${m.count} cases`);
      });
    }
  } catch (error) {
    console.error('❌ Failed to fetch statistics:', error.message);
  }
};

// Run the test
console.log('Starting ICD Integration Test...\n');
testICDIntegration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});