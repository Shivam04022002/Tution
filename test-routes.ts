import dotenv from 'dotenv';
dotenv.config();

async function testRoutes() {
  try {
    console.log('🧪 Testing Available Routes...');
    
    // Test health endpoint
    console.log('\n🏥 Testing Health Endpoint:');
    const healthResponse = await fetch('http://localhost:5000/api/health');
    const healthResult = await healthResponse.json();
    console.log('Status:', healthResponse.status);
    console.log('Response:', JSON.stringify(healthResult, null, 2));

    // Test auth routes list
    console.log('\n🔐 Testing Auth Routes:');
    
    // Test send-otp endpoint
    console.log('\n📱 Testing Send OTP:');
    const otpResponse = await fetch('http://localhost:5000/api/auth/send-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: '9999999991'
      })
    });

    const otpResult = await otpResponse.json();
    console.log('Status:', otpResponse.status);
    console.log('Response:', JSON.stringify(otpResult, null, 2));

    // Test login endpoint
    console.log('\n🔑 Testing Login:');
    const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emailOrMobile: 'admin@test.com',
        password: 'Admin123'
      })
    });

    const loginResult = await loginResponse.json();
    console.log('Status:', loginResponse.status);
    console.log('Response:', JSON.stringify(loginResult, null, 2));

  } catch (error: any) {
    console.error('💥 Test failed:', error.message);
  }
}

testRoutes();
