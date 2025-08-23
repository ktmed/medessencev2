#!/usr/bin/env node

/**
 * Test script for Advanced ICD Matcher
 * Tests the advanced search functionality with German medical terms
 */

const AdvancedICDMatcher = require('./services/advanced-icd-matcher');

async function testAdvancedICDMatcher() {
  console.log('🧪 Testing Advanced ICD Matcher');
  console.log('================================');

  let matcher = null;

  try {
    // Initialize matcher
    console.log('🔄 Initializing Advanced ICD Matcher...');
    matcher = new AdvancedICDMatcher();
    await matcher.initialize();
    console.log('✅ Matcher initialized successfully\n');

    // Test cases with German medical terms
    const testQueries = [
      'Brustkrebs',
      'Lungenkrebs', 
      'Schmerz',
      'Entzündung',
      'C50.1',
      'Hirninfarkt',
      'Bandscheibenvorfall',
      'Herzinfarkt',
      'pneumonie'
    ];

    for (const query of testQueries) {
      console.log(`🔍 Testing query: "${query}"`);
      console.log('─'.repeat(50));

      try {
        const results = await matcher.search(query, {
          maxResults: 5,
          includeMetadata: true,
          minimumScore: 0.1
        });

        console.log(`📊 Found ${results.length} results:`);
        
        results.forEach((result, index) => {
          console.log(`${index + 1}. ${result.icdCode} - ${result.label}`);
          console.log(`   Score: ${result.combinedScore.toFixed(3)} | Methods: ${result.searchMethods.map(m => m.type).join(', ')}`);
          console.log(`   Chapter: ${result.chapterNr} (${result.metadata?.chapterInfo?.germanName || 'N/A'})`);
          console.log(`   Confidence: ${result.metadata?.confidenceLevel || 'N/A'}`);
          console.log('');
        });
        
      } catch (error) {
        console.error(`❌ Error testing "${query}":`, error.message);
      }

      console.log('\n');
    }

    // Performance test
    console.log('⚡ Performance Test');
    console.log('─'.repeat(50));
    const perfStart = Date.now();
    
    const perfResults = await matcher.search('Brustkrebs mammakarzinom', {
      maxResults: 10,
      includeMetadata: true
    });
    
    const perfEnd = Date.now();
    console.log(`🚀 Search completed in ${perfEnd - perfStart}ms`);
    console.log(`📊 Found ${perfResults.length} results with semantic matching\n`);

    // Multilingual test
    console.log('🌍 Multilingual Test');
    console.log('─'.repeat(50));
    
    const multilingualQueries = ['cancer', 'tumor', 'neoplasm', 'karzinom'];
    for (const mlQuery of multilingualQueries) {
      const mlResults = await matcher.search(mlQuery, { maxResults: 3 });
      console.log(`"${mlQuery}": ${mlResults.length} results`);
      if (mlResults.length > 0) {
        console.log(`   Top: ${mlResults[0].icdCode} - ${mlResults[0].label.substring(0, 60)}...`);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  } finally {
    // Cleanup
    if (matcher) {
      await matcher.cleanup();
      console.log('🧹 Cleanup completed');
    }
  }
}

// Run the test
if (require.main === module) {
  testAdvancedICDMatcher()
    .then(() => {
      console.log('✅ All tests completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    });
}