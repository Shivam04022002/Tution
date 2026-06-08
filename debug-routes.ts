import dotenv from 'dotenv';
dotenv.config();

async function debugRoutes() {
  try {
    console.log('🔍 Debugging Routes...');
    
    // Test all possible auth endpoints
    const endpoints = [
      '/api/health',
      '/api/auth/send-otp',
      '/api/auth/verify-otp',
      '/api/auth/login',
      '/api/auth/signup',
      '/api/auth/me'
    ];

    for (const endpoint of endpoints) {
      console.log(`\n📍 Testing ${endpoint}:`);
      try {
        const response = await fetch(`http://localhost:5000${endpoint}`, {
          method: endpoint === '/api/health' ? 'GET' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: endpoint !== '/api/health' ? JSON.stringify({}) : undefined
        });
        
        console.log(`  Status: ${response.status}`);
        
        if (response.status === 404) {
          console.log(`  ❌ Route not found`);
        } else {
          const result = await response.json();
          console.log(`  ✅ Route exists - ${JSON.stringify(result).substring(0, 100)}...`);
        }
      } catch (error: any) {
        console.log(`  💥 Error: ${error.message}`);
      }
    }

    // Test with curl-like request to see what routes are actually available
    console.log('\n🌐 Testing root API endpoint:');
    try {
      const rootResponse = await fetch('http://localhost:5000/api');
      console.log(`  Status: ${rootResponse.status}`);
      if (rootResponse.status === 200) {
        console.log(`  ✅ API root accessible`);
      }
    } catch (error: any) {
      console.log(`  💥 Error: ${error.message}`);
    }

  } catch (error: any) {
    console.error('💥 Debug failed:', error.message);
  }
}

debugRoutes();
