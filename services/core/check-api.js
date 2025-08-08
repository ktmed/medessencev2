// Test node-llama-cpp API structure
async function checkAPI() {
    try {
        console.log('🔍 Checking node-llama-cpp API structure...');
        const llama = await import('node-llama-cpp');
        
        console.log('✅ Import successful');
        console.log('Available exports:', Object.keys(llama));
        
        // Common API patterns to check
        const apiChecks = [
            'LlamaCpp',
            'loadModel', 
            'ChatWrapper',
            'getLlama',
            'LlamaModel',
            'LlamaContext',
            'LlamaChat'
        ];
        
        for (const api of apiChecks) {
            if (llama[api]) {
                console.log(`✅ ${api}: ${typeof llama[api]}`);
                
                // If it's a constructor, check prototype methods
                if (typeof llama[api] === 'function' && llama[api].prototype) {
                    const methods = Object.getOwnPropertyNames(llama[api].prototype)
                        .filter(name => name !== 'constructor');
                    if (methods.length > 0) {
                        console.log(`   Methods: ${methods.join(', ')}`);
                    }
                }
            } else {
                console.log(`❌ ${api}: not found`);
            }
        }
        
    } catch (error) {
        console.error('❌ API check failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

checkAPI();