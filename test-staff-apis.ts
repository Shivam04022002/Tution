import dotenv from 'dotenv';
dotenv.config();

// Test staff APIs with staff token
async function testStaffAPIs() {
  const API_BASE = 'http://localhost:5000/api';
  
  // First login to get staff token
  console.log('🔐 Getting staff token...');
  const loginResponse = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      emailOrMobile: 'staff@test.com',
      password: 'staff123'
    })
  });

  if (!loginResponse.ok) {
    console.error('❌ Staff login failed:', await loginResponse.text());
    return;
  }

  const loginData = await loginResponse.json();
  const token = loginData.token;
  console.log('✅ Staff token obtained');

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Test all staff endpoints
  const endpoints = [
    { name: 'Dashboard', path: '/staff/dashboard' },
    { name: 'Verification Queue', path: '/staff/verification-queue' },
    { name: 'Staff Leads', path: '/staff/leads' },
    { name: 'staff Reports', path: '/staff/reports' },
  ];

  for (const endpoint of endpoints) {
    console.log(`\n📡 Testing ${endpoint.name}...`);
    
    try {
      const response = await fetch(`${API_BASE}${endpoint.path}`, {
        method: 'GET',
        headers
      });

      console.log(`📊 Status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${endpoint.name} SUCCESS`);
        console.log(`📦 Data keys:`, Object.keys(data));
        if (data.data) {
          console.log(`📋 Data sample:`, JSON.stringify(data.data, null, 2).substring(0, 200) + '...');
        }
      } else {
        const errorData = await response.json();
        console.log(`❌ ${endpoint.name} FAILED:`, errorData.message || 'Unknown error');
      }
    } catch (error: any) {
      console.log(`💥 ${endpoint.name} ERROR:`, error.message);
    }
  }
}

testStaffAPIs().catch(console.error);
