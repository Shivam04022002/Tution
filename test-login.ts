import dotenv from 'dotenv';
dotenv.config();

async function testLogin() {
  try {
    console.log('🧪 Testing Login API...');
    
    // Test admin login
    console.log('\n👑 Testing Admin Login:');
    const adminResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emailOrMobile: 'admin@test.com',
        password: 'Admin123'
      })
    });

    const adminResult: any = await adminResponse.json();
    console.log('Status:', adminResponse.status);
    console.log('Response:', JSON.stringify(adminResult, null, 2));

    // Test staff login
    console.log('\n👥 Testing Staff Login:');
    const staffResponse = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emailOrMobile: 'staff@test.com',
        password: 'staff123'
      })
    });

    const staffResult: any = await staffResponse.json();
    console.log('Status:', staffResponse.status);
    console.log('Response:', JSON.stringify(staffResult, null, 2));

    if (adminResult.success && staffResult.success) {
      console.log('\n🎉 BOTH LOGINS WORKING!');
      console.log('✅ Admin login successful');
      console.log('✅ Staff login successful');
      console.log('\n📱 Ready for mobile app login testing');
    } else {
      console.log('\n❌ Login issues detected');
      console.log('Admin success:', adminResult.success);
      console.log('Staff success:', staffResult.success);
    }

  } catch (error: any) {
    console.error('💥 Test failed:', error.message);
  }
}

testLogin();
