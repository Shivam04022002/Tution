import dotenv from 'dotenv';
dotenv.config();

try {
  console.log('🔍 Testing Auth Controller Import...');
  
  // Test importing the auth controller functions
  const authController = require('./src/controllers/authController');
  
  console.log('✅ Auth controller imported successfully');
  console.log('Available functions:', Object.keys(authController));
  
  // Test if login function exists
  if (authController.login) {
    console.log('✅ Login function found');
  } else {
    console.log('❌ Login function not found');
  }
  
  // Test if other functions exist
  const requiredFunctions = ['sendOTP', 'verifyOTP', 'login', 'signup', 'getCurrentUser'];
  requiredFunctions.forEach(func => {
    if (authController[func]) {
      console.log(`✅ ${func} function found`);
    } else {
      console.log(`❌ ${func} function not found`);
    }
  });
  
} catch (error: any) {
  console.error('💥 Import test failed:', error.message);
  console.error('Stack:', error.stack);
}
