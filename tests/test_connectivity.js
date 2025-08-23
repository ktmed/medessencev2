#!/usr/bin/env node
/**
 * Test Frontend-Backend Connectivity for MedEssenceAI
 * Target: medessencev3-test.vercel.app + medessence-backend.herokuapp.com
 */

const FRONTEND_URL = 'https://medessencev3-test-kerem-tomaks-projects.vercel.app';
const BACKEND_URL = 'https://medessence-backend.herokuapp.com';

async function testConnectivity() {
  console.log('🔗 Testing MedEssenceAI Frontend-Backend Connectivity');
  console.log('=====================================================');
  console.log(`Frontend: ${FRONTEND_URL}`);
  console.log(`Backend: ${BACKEND_URL}`);
  console.log('');

  const results = {
    frontend: { status: 'pending', details: {} },
    backend: { status: 'pending', details: {} },
    cors: { status: 'pending', details: {} },
    websocket: { status: 'pending', details: {} }
  };

  // Test 1: Frontend Accessibility
  console.log('🌐 Test 1: Frontend Accessibility');
  console.log('----------------------------------');
  try {
    const frontendResponse = await fetch(FRONTEND_URL, {
      method: 'GET',
      headers: { 'User-Agent': 'MedEssenceAI-Test/1.0' }
    });
    
    results.frontend.status = frontendResponse.ok ? 'pass' : 'fail';
    results.frontend.details = {
      status: frontendResponse.status,
      statusText: frontendResponse.statusText,
      headers: Object.fromEntries(frontendResponse.headers.entries())
    };
    
    if (frontendResponse.ok) {
      console.log('✅ Frontend accessible');
      console.log(`   Status: ${frontendResponse.status}`);
      console.log(`   Content-Type: ${frontendResponse.headers.get('content-type')}`);
    } else {
      console.log('❌ Frontend not accessible');
      console.log(`   Status: ${frontendResponse.status} ${frontendResponse.statusText}`);
    }
  } catch (error) {
    results.frontend.status = 'error';
    results.frontend.details = { error: error.message };
    console.log('❌ Frontend connection failed');
    console.log(`   Error: ${error.message}`);
  }

  console.log('');

  // Test 2: Backend Health Check
  console.log('🏥 Test 2: Backend Health Check');
  console.log('--------------------------------');
  try {
    const healthResponse = await fetch(`${BACKEND_URL}/api/health`, {
      method: 'GET',
      headers: { 'User-Agent': 'MedEssenceAI-Test/1.0' }
    });
    
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      results.backend.status = 'pass';
      results.backend.details = healthData;
      
      console.log('✅ Backend health check passed');
      console.log(`   Status: ${healthData.status}`);
      console.log(`   Version: ${healthData.version}`);
      console.log(`   Environment: ${healthData.environment}`);
      
      if (healthData.aiProviders) {
        console.log('   AI Providers:');
        Object.entries(healthData.aiProviders).forEach(([provider, status]) => {
          console.log(`     ${provider}: ${status}`);
        });
      }
    } else {
      results.backend.status = 'fail';
      results.backend.details = {
        status: healthResponse.status,
        statusText: healthResponse.statusText
      };
      console.log('❌ Backend health check failed');
      console.log(`   Status: ${healthResponse.status} ${healthResponse.statusText}`);
    }
  } catch (error) {
    results.backend.status = 'error';
    results.backend.details = { error: error.message };
    console.log('❌ Backend connection failed');
    console.log(`   Error: ${error.message}`);
  }

  console.log('');

  // Test 3: CORS Configuration
  console.log('🔐 Test 3: CORS Configuration');
  console.log('------------------------------');
  try {
    const corsResponse = await fetch(`${BACKEND_URL}/api/health`, {
      method: 'OPTIONS',
      headers: {
        'Origin': FRONTEND_URL,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    });
    
    const corsHeaders = {
      'access-control-allow-origin': corsResponse.headers.get('access-control-allow-origin'),
      'access-control-allow-methods': corsResponse.headers.get('access-control-allow-methods'),
      'access-control-allow-headers': corsResponse.headers.get('access-control-allow-headers'),
      'access-control-allow-credentials': corsResponse.headers.get('access-control-allow-credentials')
    };
    
    results.cors.details = corsHeaders;
    
    if (corsHeaders['access-control-allow-origin'] === FRONTEND_URL || corsHeaders['access-control-allow-origin'] === '*') {
      results.cors.status = 'pass';
      console.log('✅ CORS properly configured');
      console.log(`   Allowed Origin: ${corsHeaders['access-control-allow-origin']}`);
      console.log(`   Allowed Methods: ${corsHeaders['access-control-allow-methods']}`);
      console.log(`   Credentials: ${corsHeaders['access-control-allow-credentials']}`);
    } else {
      results.cors.status = 'fail';
      console.log('❌ CORS misconfigured');
      console.log(`   Expected Origin: ${FRONTEND_URL}`);
      console.log(`   Actual Origin: ${corsHeaders['access-control-allow-origin']}`);
    }
  } catch (error) {
    results.cors.status = 'error';
    results.cors.details = { error: error.message };
    console.log('❌ CORS test failed');
    console.log(`   Error: ${error.message}`);
  }

  console.log('');

  // Test 4: WebSocket Connection Test
  console.log('🔌 Test 4: WebSocket Connection');
  console.log('--------------------------------');
  
  // Note: This is a basic Socket.IO endpoint test
  try {
    const wsTestResponse = await fetch(`${BACKEND_URL}/socket.io/?transport=polling`, {
      method: 'GET',
      headers: {
        'Origin': FRONTEND_URL
      }
    });
    
    if (wsTestResponse.ok) {
      results.websocket.status = 'pass';
      results.websocket.details = {
        status: wsTestResponse.status,
        contentType: wsTestResponse.headers.get('content-type')
      };
      console.log('✅ WebSocket endpoint accessible');
      console.log(`   Status: ${wsTestResponse.status}`);
      console.log(`   Content-Type: ${wsTestResponse.headers.get('content-type')}`);
    } else {
      results.websocket.status = 'fail';
      results.websocket.details = {
        status: wsTestResponse.status,
        statusText: wsTestResponse.statusText
      };
      console.log('❌ WebSocket endpoint not accessible');
      console.log(`   Status: ${wsTestResponse.status}`);
    }
  } catch (error) {
    results.websocket.status = 'error';
    results.websocket.details = { error: error.message };
    console.log('❌ WebSocket test failed');
    console.log(`   Error: ${error.message}`);
  }

  console.log('');

  // Test Summary
  console.log('📊 Test Summary');
  console.log('================');
  
  const testResults = [
    { name: 'Frontend Access', status: results.frontend.status },
    { name: 'Backend Health', status: results.backend.status },
    { name: 'CORS Config', status: results.cors.status },
    { name: 'WebSocket', status: results.websocket.status }
  ];
  
  testResults.forEach(test => {
    const icon = test.status === 'pass' ? '✅' : test.status === 'fail' ? '❌' : '⚠️';
    console.log(`${icon} ${test.name}: ${test.status.toUpperCase()}`);
  });
  
  const passCount = testResults.filter(t => t.status === 'pass').length;
  const totalCount = testResults.length;
  
  console.log('');
  console.log(`Overall: ${passCount}/${totalCount} tests passed`);
  
  if (passCount === totalCount) {
    console.log('🎉 All connectivity tests passed! System ready for functional testing.');
  } else {
    console.log('🔧 Some tests failed. Check configuration and redeploy before proceeding.');
  }

  // Save detailed results
  const timestamp = new Date().toISOString();
  const detailedResults = {
    timestamp,
    frontend_url: FRONTEND_URL,
    backend_url: BACKEND_URL,
    test_results: results,
    summary: {
      total_tests: totalCount,
      passed_tests: passCount,
      success_rate: `${Math.round((passCount / totalCount) * 100)}%`
    }
  };

  console.log('');
  console.log('💾 Detailed test results:');
  console.log(JSON.stringify(detailedResults, null, 2));

  return detailedResults;
}

// Execute tests if run directly
if (require.main === module) {
  testConnectivity()
    .then(results => {
      process.exit(results.summary.passed_tests === results.summary.total_tests ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testConnectivity, FRONTEND_URL, BACKEND_URL };