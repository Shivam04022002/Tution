import { bootstrapAdmin } from './bootstrapAdmin';
import { bootstrapStaff } from './bootstrapStaff';

// System bootstrap function that runs on backend startup
export async function bootstrapSystem(): Promise<{ 
  success: boolean; 
  message: string; 
  results: { admin?: any; staff?: any };
}> {
  console.log('🚀 Starting System Bootstrap...');
  
  const results: { admin?: any; staff?: any } = {};
  const messages: string[] = [];

  try {
    // Bootstrap Admin
    console.log('📋 Step 1: Bootstrap Admin Account');
    const adminResult = await bootstrapAdmin();
    
    if (adminResult.success) {
      results.admin = adminResult.admin;
      messages.push(`✅ Admin: ${adminResult.message}`);
    } else {
      messages.push(`❌ Admin: ${adminResult.message}`);
    }

    // Bootstrap Staff
    console.log('📋 Step 2: Bootstrap Staff Account');
    const staffResult = await bootstrapStaff();
    
    if (staffResult.success) {
      results.staff = staffResult.staff;
      messages.push(`✅ Staff: ${staffResult.message}`);
    } else {
      messages.push(`❌ Staff: ${staffResult.message}`);
    }

    // Overall result
    const adminSuccess = adminResult.success;
    const staffSuccess = staffResult.success;
    const overallSuccess = adminSuccess && staffSuccess;

    console.log('📊 Bootstrap Results:');
    messages.forEach(msg => console.log(`   ${msg}`));

    if (overallSuccess) {
      console.log('🎉 System Bootstrap completed successfully');
    } else {
      console.log('⚠️ System Bootstrap completed with some issues');
    }

    return {
      success: overallSuccess,
      message: overallSuccess 
        ? 'System bootstrap completed successfully' 
        : 'System bootstrap completed with issues',
      results
    };

  } catch (error: any) {
    console.error('💥 System bootstrap failed:', error);
    return {
      success: false,
      message: `System bootstrap failed: ${error.message}`,
      results
    };
  }
}

// Export individual bootstrap functions for direct access
export { bootstrapAdmin, bootstrapStaff };
