const fetch = require('node-fetch');
require('dotenv').config();

async function testLeadsEndpoint() {
  try {
    // Get staff token
    const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'staff@test.com', password: 'password123' })
    });
    
    const loginData = await loginResponse.json();
    const token = loginData.token;
    
    // Test leads endpoint
    const leadsResponse = await fetch('http://localhost:3000/api/staff/leads', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('Leads endpoint status:', leadsResponse.status);
    if (leadsResponse.status === 404) {
      console.log('✅ Leads endpoint successfully removed (404 Not Found)');
    } else {
      const error = await leadsResponse.json();
      console.log('❌ Leads endpoint still exists:', error.message);
    }
  } catch (error) {
    console.log('Error:', error.message);
  }
}

testLeadsEndpoint();
