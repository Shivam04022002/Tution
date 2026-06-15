/**
 * DEMO ACCOUNTS SEED SCRIPT
 * =========================
 * 
 * Creates demo users for dashboard testing:
 * - Demo Parent (parent@test.com / Parent@123)
 * - Demo Teacher (teacher@test.com / Teacher@123)
 * - TutorMatch between them
 * - TutorApplication (pending)
 * - DemoClass (scheduled for tomorrow)
 * 
 * Usage: 
 *   Development: npm run seed-demo:dev
 *   Production:  npm run seed-demo (requires --force flag)
 *   Direct:      npx ts-node src/scripts/seedDemoAccounts.ts [--force]
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';
import readline from 'readline';

// Load environment variables
config();

// Models will be loaded after database connection
let User: any, ParentRequirement: any, TeacherProfile: any, TutorMatch: any, TutorApplication: any, DemoClass: any;

// Parse CLI arguments
const args = process.argv.slice(2);
const FORCE_MODE = args.includes('--force');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Safety check - prevent accidental production seeding
const safetyCheck = async (): Promise<boolean> => {
  if (IS_PRODUCTION && !FORCE_MODE) {
    console.log('\n⚠️  WARNING: You are about to seed demo data in PRODUCTION environment!');
    console.log('This will create test accounts with known credentials.');
    console.log('\nType "yes" to continue, or press Ctrl+C to abort:');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question('> ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase().trim() === 'yes');
      });
    });
  }
  return true;
};

// Load models dynamically after DB connection
const loadModels = (): void => {
  try {
    const userModule = require('../models/User');
    const parentReqModule = require('../models/ParentRequirement');
    const teacherProfileModule = require('../models/TeacherProfile');
    const tutorMatchModule = require('../models/TutorMatch');
    const tutorAppModule = require('../models/TutorApplication');
    const demoClassModule = require('../models/DemoClass');

    User = userModule.User;
    ParentRequirement = parentReqModule.ParentRequirement;
    TeacherProfile = teacherProfileModule.TeacherProfile;
    TutorMatch = tutorMatchModule.TutorMatch;
    TutorApplication = tutorAppModule.TutorApplication;
    DemoClass = demoClassModule.DemoClass;

    // Validate models loaded
    if (!User || !ParentRequirement || !TeacherProfile || !TutorMatch || !TutorApplication || !DemoClass) {
      console.error('❌ One or more models failed to load');
      process.exit(1);
    }

    console.log('✅ Models loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load models:', error);
    process.exit(1);
  }
};

// Demo Account Data
const DEMO_PARENT = {
  role: 'parent',
  fullName: 'Demo Parent',
  mobileNumber: '9999999991',
  email: 'parent@test.com',
  password: 'Parent@123',
};

const DEMO_TEACHER = {
  role: 'teacher',
  fullName: 'Demo Teacher',
  mobileNumber: '9999999992',
  email: 'teacher@test.com',
  password: 'Teacher@123',
};

// Generate unique IDs
const generateId = (prefix: string): string => {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
};

// Hash password
const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

// Connect to MongoDB
const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition_app';
  
  try {
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};

// Clear existing demo data
const clearDemoData = async (): Promise<void> => {
  console.log('\n🧹 Clearing existing demo data...');
  
  // Find and delete demo users
  const parentUser = await User.findOne({ email: DEMO_PARENT.email });
  const teacherUser = await User.findOne({ email: DEMO_TEACHER.email });
  
  if (parentUser) {
    await ParentRequirement.deleteMany({ parentId: parentUser._id });
    await TutorMatch.deleteMany({ parentId: parentUser._id });
    await TutorApplication.deleteMany({ parentId: parentUser._id });
    await DemoClass.deleteMany({ parentId: parentUser._id });
    await User.findByIdAndDelete(parentUser._id);
    console.log('  🗑️  Deleted existing demo parent and related data');
  }
  
  if (teacherUser) {
    await TeacherProfile.deleteMany({ userId: teacherUser._id });
    await TutorMatch.deleteMany({ teacherId: teacherUser._id });
    await TutorApplication.deleteMany({ teacherId: teacherUser._id });
    await DemoClass.deleteMany({ teacherId: teacherUser._id });
    await User.findByIdAndDelete(teacherUser._id);
    console.log('  🗑️  Deleted existing demo teacher and related data');
  }
  
  if (!parentUser && !teacherUser) {
    console.log('  ℹ️  No existing demo data found');
  }
};

// Create Demo Parent
const createDemoParent = async (): Promise<{ user: any; requirement: any }> => {
  console.log('\n👤 Creating Demo Parent...');
  
  // Create User
  const hashedPassword = await hashPassword(DEMO_PARENT.password);
  const parentUser = new User({
    email: DEMO_PARENT.email,
    mobileNumber: DEMO_PARENT.mobileNumber,
    password: hashedPassword,
    role: 'parent',
    profile: {
      firstName: 'Demo',
      lastName: 'Parent',
    },
    profileCompleted: true,
    onboardingCompleted: true,
  });
  
  await parentUser.save();
  console.log(`  ✅ Parent User created: ${parentUser._id}`);
  
  // Create ParentRequirement
  const requirement = new ParentRequirement({
    parentId: parentUser._id,
    requirementId: generateId('REQ'),
    studentDetails: {
      studentName: 'Rahul',
      age: 15,
      grade: 'Class 10',
      board: 'CBSE',
      schoolName: 'Demo School',
      genderPreference: 'any',
      multipleChildren: false,
    },
    subjects: ['Mathematics', 'Science'],
    languagePreference: ['English', 'Hindi'],
    tuitionType: 'home',
    location: {
      address: '123 Demo Street, Kanpur',
      city: 'Kanpur',
      pincode: '208001',
      coordinates: {
        latitude: 26.4499,
        longitude: 80.3319,
      },
      teachingRadius: 5,
    },
    schedule: {
      daysPerWeek: '3',
      preferredTimings: ['Evening'],
      startDate: new Date().toISOString().split('T')[0],
    },
    tutorPreferences: 'Experienced tutor preferred',
    budget: {
      minAmount: 4000,
      maxAmount: 5000,
      negotiationAllowed: true,
    },
    status: 'active',
    priority: 'medium',
    matchedTutors: [],
    totalMatches: 0,
    views: 0,
    unlocks: 0,
    isActive: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
  
  await requirement.save();
  console.log(`  ✅ ParentRequirement created: ${requirement.requirementId}`);
  
  return { user: parentUser, requirement };
};

// Create Demo Teacher
const createDemoTeacher = async (): Promise<{ user: any; profile: any }> => {
  console.log('\n👨‍🏫 Creating Demo Teacher...');
  
  // Create User
  const hashedPassword = await hashPassword(DEMO_TEACHER.password);
  const teacherUser = new User({
    email: DEMO_TEACHER.email,
    mobileNumber: DEMO_TEACHER.mobileNumber,
    password: hashedPassword,
    role: 'teacher',
    profile: {
      firstName: 'Demo',
      lastName: 'Teacher',
    },
    profileCompleted: true,
    onboardingCompleted: true,
  });
  
  await teacherUser.save();
  console.log(`  ✅ Teacher User created: ${teacherUser._id}`);
  
  // Create TeacherProfile with schema-compliant values
  const teacherProfile = new TeacherProfile({
    userId: teacherUser._id,
    basicDetails: {
      fullName: 'Demo Teacher',
      gender: 'male',
      dateOfBirth: new Date('1990-01-01'),
      mobileNumber: '9999999992',
      email: 'teacher@test.com',
      languages: ['English', 'Hindi'],
      profilePhoto: '',
    },
    education: {
      highestQualification: 'B.Tech',
      degree: 'B.Tech',
      university: 'IIT Kanpur',
      yearOfCompletion: 2015,
      certifications: [],
      status: 'completed',
    },
    teachingDetails: {
      subjects: ['Mathematics', 'Science'],
      classes: ['Class 8', 'Class 9', 'Class 10'],
      boards: ['CBSE', 'State Board'],
      specialization: 'Mathematics',
      teachingModes: ['student_home', 'online'],
      groupTuitionOption: false,
      groupSize: 5,  // FIXED: Changed from 0 to 5 (valid range: 2-20)
      groupRate: 0,
    },
    locationAvailability: {
      address: '456 Teacher Colony, Kanpur',
      city: 'Kanpur',
      pincode: '208002',
      coordinates: {
        latitude: 26.4600,
        longitude: 80.3500,
      },
      preferredAreas: ['Kanpur', 'Kidwai Nagar', 'Geeta Nagar'],
      teachingRadius: 10,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      availableTimeSlots: ['Morning', 'Afternoon', 'Evening'],
      vacationMode: false,
    },
    bio: 'Experienced Mathematics and Science teacher with 5+ years of teaching experience. Specializes in CBSE curriculum for classes 8-10.',
    pricingRevenue: {
      hourlyRate: 500,
      monthlyRate: 5000,
      currentRevenue: '0',
      experienceYears: 5,
      pricingStrategy: 'competitive',
      negotiationAllowed: true,
    },
    verificationDocuments: {
      aadhaarCard: 'DEMO-AADHAAR-1234',  // FIXED: Added valid placeholder
      panCard: 'DEMO-PAN-ABCDE1234F',    // FIXED: Added valid placeholder
      qualificationDocuments: [],
      portfolioPhotos: [],
    },
    verificationStatus: 'verified',  // FIXED: Changed from 'approved' to 'verified'
    stats: {
      totalStudents: 0,
      activeStudents: 0,
      completedClasses: 0,
      averageRating: 4.8,
      totalReviews: 12,
      totalEarnings: 0,
      leadUnlocks: 0,
      responseRate: 95,
      responseTime: '15 min',
    },
    preferences: {
      notifications: true,
      whatsappUpdates: true,
      emailUpdates: true,
      leadAlerts: true,
    },
    isActive: true,
    isVerified: true,
    isBlocked: false,
  });
  
  await teacherProfile.save();
  console.log(`  ✅ TeacherProfile created: ${teacherProfile._id}`);
  
  return { user: teacherUser, profile: teacherProfile };
};

// Create TutorMatch
const createTutorMatch = async (
  parentUser: any,
  requirement: any,
  teacherUser: any,
  teacherProfile: any
): Promise<any> => {
  console.log('\n🔗 Creating TutorMatch...');
  
  const match = new TutorMatch({
    requirementId: requirement._id,
    teacherId: teacherUser._id,
    teacherProfileId: teacherProfile._id,
    parentId: parentUser._id,
    matchId: generateId('MAT'),
    overallScore: 92,
    breakdown: {
      subjectScore: 100,
      subjectMatchDetails: {
        requirementSubjects: ['Mathematics', 'Science'],
        teacherSubjects: ['Mathematics', 'Science'],
        matchedSubjects: ['Mathematics', 'Science'],
        matchPercentage: 100,
      },
      classScore: 100,
      classMatchDetails: {
        requirementGrade: 'Class 10',
        teacherClasses: ['Class 8', 'Class 9', 'Class 10'],
        isMatch: true,
      },
      boardScore: 100,
      boardMatchDetails: {
        requirementBoard: 'CBSE',
        teacherBoards: ['CBSE', 'State Board'],
        isMatch: true,
      },
      locationScore: 95,
      locationMatchDetails: {
        requirementCity: 'Kanpur',
        teacherCity: 'Kanpur',
        requirementPincode: '208001',
        teacherPincode: '208002',
        distance: 2.5,
        teachingRadius: 10,
        isWithinRadius: true,
      },
      budgetScore: 100,
      budgetMatchDetails: {
        requirementMinBudget: 4000,
        requirementMaxBudget: 5000,
        teacherHourlyRate: 500,
        isWithinBudget: true,
      },
      modeScore: 100,
      modeMatchDetails: {
        requirementMode: 'home',
        teacherModes: ['student_home', 'online'],
        isMatch: true,
      },
      timingScore: 90,
      timingMatchDetails: {
        requirementTimeSlots: ['Evening'],
        teacherDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        teacherTimeSlots: ['Morning', 'Afternoon', 'Evening'],
        timeOverlap: ['Evening'],
        timeScore: 90,
      },
      bonusDetails: {
        genderScore: 0,
        languageScore: 10,
        experienceScore: 15,
        totalBonus: 25,
      },
    },
    algorithmVersion: 'v1.0',
    status: 'recommended',
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isActive: true,
  });
  
  await match.save();
  console.log(`  ✅ TutorMatch created: ${match.matchId} (Score: ${match.overallScore}%)`);
  
  return match;
};

// Create TutorApplication
const createTutorApplication = async (
  requirement: any,
  teacherUser: any,
  teacherProfile: any,
  parentUser: any
): Promise<any> => {
  console.log('\n📝 Creating TutorApplication...');
  
  const application = new TutorApplication({
    parentRequirementId: requirement._id,
    teacherId: teacherUser._id,
    teacherProfileId: teacherProfile._id,
    parentId: parentUser._id,
    applicationId: generateId('APP'),
    status: 'pending',
    message: 'I would love to teach Rahul Mathematics and Science. I have 5 years of experience with CBSE curriculum and have helped many students score 90+ in board exams.',
    proposedFee: 4800,
    proposedSchedule: {
      daysPerWeek: '3',
      preferredTimeSlots: ['Evening (5 PM - 7 PM)'],
    },
    viewedByParent: false,
    demoScheduled: false,
    isActive: true,
  });
  
  await application.save();
  console.log(`  ✅ TutorApplication created: ${application.applicationId}`);
  
  return application;
};

// Create DemoClass
const createDemoClass = async (
  parentUser: any,
  teacherUser: any,
  teacherProfile: any,
  requirement: any,
  application: any
): Promise<any> => {
  console.log('\n📅 Creating DemoClass...');
  
  // Schedule for tomorrow at 5 PM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(17, 0, 0, 0);
  
  const demoClass = new DemoClass({
    demoId: generateId('DEMO'),
    parentId: parentUser._id,
    teacherId: teacherUser._id,
    teacherProfileId: teacherProfile._id,
    requirementId: requirement._id,
    applicationId: application._id,
    studentDetails: {
      studentName: 'Rahul',
      grade: 'Class 10',
      subject: 'Mathematics',
    },
    scheduledDate: tomorrow,
    scheduledTime: '5:00 PM',
    duration: 60,
    mode: 'offline',
    meetingDetails: {
      platform: 'in_person',  // FIXED: Changed from 'In-Person' to 'in_person' (valid enum)
      address: '123 Demo Street, Kanpur',
    },
    status: 'scheduled',
    isActive: true,
  });
  
  await demoClass.save();
  console.log(`  ✅ DemoClass created: ${demoClass.demoId}`);
  console.log(`     Scheduled: ${tomorrow.toDateString()} at 5:00 PM`);
  
  return demoClass;
};

// Main seed function
const seedDemoAccounts = async (): Promise<void> => {
  console.log('='.repeat(60));
  console.log('🌱 DEMO ACCOUNTS SEED SCRIPT');
  console.log('='.repeat(60));
  
  // Safety check for production
  const shouldProceed = await safetyCheck();
  if (!shouldProceed) {
    console.log('\n❌ Seeding aborted by user');
    process.exit(0);
  }
  
  try {
    await connectDB();
    loadModels(); // Load models after DB connection
    await clearDemoData();
    
    // Create accounts
    const { user: parentUser, requirement } = await createDemoParent();
    const { user: teacherUser, profile: teacherProfile } = await createDemoTeacher();
    
    // Create relationships
    const match = await createTutorMatch(parentUser, requirement, teacherUser, teacherProfile);
    const application = await createTutorApplication(requirement, teacherUser, teacherProfile, parentUser);
    const demoClass = await createDemoClass(parentUser, teacherUser, teacherProfile, requirement, application);
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ SEED COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\n📊 SUMMARY:');
    console.log('  • Demo Parent User: parent@test.com / Parent@123');
    console.log('  • Demo Teacher User: teacher@test.com / Teacher@123');
    console.log(`  • TutorMatch: ${match.matchId} (Score: ${match.overallScore}%)`);
    console.log(`  • TutorApplication: ${application.applicationId} (Status: ${application.status})`);
    console.log(`  • DemoClass: ${demoClass.demoId} (Status: ${demoClass.status})`);
    console.log('\n🔑 LOGIN CREDENTIALS:');
    console.log('  Parent Dashboard:');
    console.log('    Email: parent@test.com');
    console.log('    Password: Parent@123');
    console.log('  Teacher Dashboard:');
    console.log('    Email: teacher@test.com');
    console.log('    Password: Teacher@123');
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ SEED FAILED:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 MongoDB Disconnected');
    process.exit(0);
  }
};

// Run if executed directly
if (require.main === module) {
  seedDemoAccounts();
}

export { seedDemoAccounts };
