/// <reference types="node" />

/**
 * LOCAL DATABASE SEED SCRIPT (NON-DESTRUCTIVE)
 * =============================================
 *
 * Seeds admin, demo parent, and demo teacher accounts for local development.
 * Uses local MongoDB: mongodb://127.0.0.1:27017/tuitionAppDB
 *
 * This script is IDEMPOTENT - safe to run multiple times without deleting data.
 *
 * Usage:
 *   npm run seed:local
 *   npx ts-node src/scripts/seedLocal.ts
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// Hardcoded local MongoDB URI
const LOCAL_MONGODB_URI = 'mongodb://127.0.0.1:27017/tuitionAppDB';

// Models will be loaded after database connection
let User: any;
let ParentRequirement: any;
let TeacherProfile: any;
let TutorMatch: any;
let TutorApplication: any;

// Seed Account Data
const ADMIN_USER = {
  role: 'admin',
  fullName: 'System Administrator',
  mobileNumber: '9999999999',
  email: 'admin@tuitionapp.com',
  password: 'Admin@123',
};

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

// Track creation status for summary
const summary = {
  adminCreated: false,
  parentCreated: false,
  teacherCreated: false,
  requirementCreated: false,
  profileCreated: false,
  matchCreated: false,
  applicationCreated: false,
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

// Load models dynamically after DB connection
const loadModels = (): void => {
  try {
    const userModule = require('../models/User');
    const parentReqModule = require('../models/ParentRequirement');
    const teacherProfileModule = require('../models/TeacherProfile');
    const tutorMatchModule = require('../models/TutorMatch');
    const tutorAppModule = require('../models/TutorApplication');

User = userModule.User || userModule.default || userModule;
ParentRequirement = parentReqModule.ParentRequirement || parentReqModule.default || parentReqModule;
TeacherProfile = teacherProfileModule.TeacherProfile || teacherProfileModule.default || teacherProfileModule;
TutorMatch = tutorMatchModule.TutorMatch || tutorMatchModule.default || tutorMatchModule;
TutorApplication = tutorAppModule.TutorApplication || tutorAppModule.default || tutorAppModule;

    console.log('✅ Models loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load models:', error);
    process.exit(1);
  }
};

// Connect to MongoDB
const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(LOCAL_MONGODB_URI);
    console.log('✅ Connected to Local MongoDB:', LOCAL_MONGODB_URI);
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    console.log('\n⚠️  Make sure MongoDB is running locally:');
    console.log('  Windows: net start MongoDB');
    console.log('  macOS/Linux: mongod --dbpath /path/to/db');
    process.exit(1);
  }
};

// Create Admin User (idempotent)
const createAdminUser = async (): Promise<any | null> => {
  console.log('\n🔍 Checking Admin User...');

  const existing = await User.findOne({ email: ADMIN_USER.email });
  if (existing) {
    console.log('⏭️  Already exists, skipping...');
    return existing;
  }

  const hashedPassword = await hashPassword(ADMIN_USER.password);
  const admin = new User({
    email: ADMIN_USER.email,
    mobileNumber: ADMIN_USER.mobileNumber,
    password: hashedPassword,
    role: 'admin',
    profile: {
      firstName: 'System',
      lastName: 'Administrator',
    },
    profileCompleted: true,
    onboardingCompleted: true,
    isActive: true,
  });

  await admin.save();
  summary.adminCreated = true;
  console.log(`✅ Admin User created: ${admin._id}`);

  return admin;
};

// Create Demo Parent (idempotent)
const createDemoParent = async (): Promise<any | null> => {
  console.log('\n🔍 Checking Demo Parent...');

  const existing = await User.findOne({ email: DEMO_PARENT.email });
  if (existing) {
    console.log('⏭️  Already exists, skipping...');
    return existing;
  }

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
  summary.parentCreated = true;
  console.log(`✅ Parent User created: ${parentUser._id}`);

  return parentUser;
};

// Create Demo Teacher (idempotent)
const createDemoTeacher = async (): Promise<any | null> => {
  console.log('\n🔍 Checking Demo Teacher...');

  const existing = await User.findOne({ email: DEMO_TEACHER.email });
  if (existing) {
    console.log('⏭️  Already exists, skipping...');
    return existing;
  }

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
  summary.teacherCreated = true;
  console.log(`✅ Teacher User created: ${teacherUser._id}`);

  return teacherUser;
};

// Create ParentRequirement (idempotent - only if parent has no requirements)
const createParentRequirement = async (parentUser: any): Promise<any | null> => {
  console.log('\n🔍 Checking ParentRequirement...');

  const existing = await ParentRequirement.findOne({ parentId: parentUser._id });
  if (existing) {
    console.log('⏭️  Already exists, skipping...');
    return existing;
  }

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
  summary.requirementCreated = true;
  console.log(`✅ ParentRequirement created: ${requirement.requirementId}`);

  return requirement;
};

// Create TeacherProfile (idempotent - only if teacher has no profile)
const createTeacherProfile = async (teacherUser: any): Promise<any | null> => {
  console.log('\n🔍 Checking TeacherProfile...');

  const existing = await TeacherProfile.findOne({ userId: teacherUser._id });
  if (existing) {
    console.log('⏭️  Already exists, skipping...');
    return existing;
  }

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
      groupSize: 5,
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
    bio: 'Experienced Mathematics and Science teacher with 5+ years of teaching experience.',
    pricingRevenue: {
      hourlyRate: 500,
      monthlyRate: 5000,
      currentRevenue: '0',
      experienceYears: 5,
      pricingStrategy: 'competitive',
      negotiationAllowed: true,
    },
    verificationDocuments: {
      aadhaarCard: 'DEMO-AADHAAR-1234',
      panCard: 'DEMO-PAN-ABCDE1234F',
      qualificationDocuments: [],
      portfolioPhotos: [],
    },
    verificationStatus: 'verified',
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
  summary.profileCreated = true;
  console.log(`✅ TeacherProfile created: ${teacherProfile._id}`);

  return teacherProfile;
};

// Create TutorMatch (idempotent - check if match exists between parent and teacher)
const createTutorMatch = async (
  parentUser: any,
  requirement: any,
  teacherUser: any,
  teacherProfile: any
): Promise<any | null> => {
  console.log('\n🔍 Checking TutorMatch...');

  const existing = await TutorMatch.findOne({
    parentId: parentUser._id,
    teacherId: teacherUser._id,
  });
  if (existing) {
    console.log('⏭️  Already exists, skipping...');
    return existing;
  }

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
  summary.matchCreated = true;
  console.log(`✅ TutorMatch created: ${match.matchId} (Score: ${match.overallScore}%)`);

  return match;
};

// Create TutorApplication (idempotent - check if application exists)
const createTutorApplication = async (
  requirement: any,
  teacherUser: any,
  teacherProfile: any,
  parentUser: any
): Promise<any | null> => {
  console.log('\n🔍 Checking TutorApplication...');

  const existing = await TutorApplication.findOne({
    parentRequirementId: requirement._id,
    teacherId: teacherUser._id,
    parentId: parentUser._id,
  });
  if (existing) {
    console.log('⏭️  Already exists, skipping...');
    return existing;
  }

  const application = new TutorApplication({
    parentRequirementId: requirement._id,
    teacherId: teacherUser._id,
    teacherProfileId: teacherProfile._id,
    parentId: parentUser._id,
    applicationId: generateId('APP'),
    status: 'pending',
    message: 'I would love to teach Rahul Mathematics and Science. I have 5 years of experience.',
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
  summary.applicationCreated = true;
  console.log(`✅ TutorApplication created: ${application.applicationId}`);

  return application;
};

// Print summary
const printSummary = (): void => {
  console.log('\n' + '='.repeat(35));
  console.log('SEED SUMMARY');
  console.log('='.repeat(35));
  console.log(`Admin Created:         ${summary.adminCreated ? 'Yes' : 'No'}`);
  console.log(`Parent Created:        ${summary.parentCreated ? 'Yes' : 'No'}`);
  console.log(`Teacher Created:       ${summary.teacherCreated ? 'Yes' : 'No'}`);
  console.log(`Requirement Created:   ${summary.requirementCreated ? 'Yes' : 'No'}`);
  console.log(`Profile Created:       ${summary.profileCreated ? 'Yes' : 'No'}`);
  console.log(`Match Created:         ${summary.matchCreated ? 'Yes' : 'No'}`);
  console.log(`Application Created:   ${summary.applicationCreated ? 'Yes' : 'No'}`);
  console.log('='.repeat(35));
};

// Main seed function
const seedLocalDatabase = async (): Promise<void> => {
  console.log('='.repeat(60));
  console.log(' LOCAL DATABASE SEED SCRIPT (NON-DESTRUCTIVE)');
  console.log(' MongoDB: mongodb://127.0.0.1:27017/tuitionAppDB');
  console.log('='.repeat(60));

  try {
    await connectDB();
    loadModels();

    // Create users (idempotent)
    const admin = await createAdminUser();
    const parentUser = await createDemoParent();
    const teacherUser = await createDemoTeacher();

    // Create related data (idempotent)
    let requirement = null;
    let teacherProfile = null;
    let match = null;
    let application = null;

    if (parentUser) {
      requirement = await createParentRequirement(parentUser);
    }

    if (teacherUser) {
      teacherProfile = await createTeacherProfile(teacherUser);
    }

    if (parentUser && teacherUser && requirement && teacherProfile) {
      match = await createTutorMatch(parentUser, requirement, teacherUser, teacherProfile);
      application = await createTutorApplication(requirement, teacherUser, teacherProfile, parentUser);
    }

    // Print summary
    printSummary();

    console.log('\n✅ SEED COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\n🔑 LOGIN CREDENTIALS:');
    console.log('  --------------------');
    console.log('  ADMIN:');
    console.log(`    Email:    ${ADMIN_USER.email}`);
    console.log(`    Password: ${ADMIN_USER.password}`);
    console.log('  --------------------');
    console.log('  DEMO PARENT:');
    console.log(`    Email:    ${DEMO_PARENT.email}`);
    console.log(`    Password: ${DEMO_PARENT.password}`);
    console.log('  --------------------');
    console.log('  DEMO TEACHER:');
    console.log(`    Email:    ${DEMO_TEACHER.email}`);
    console.log(`    Password: ${DEMO_TEACHER.password}`);
    console.log('  --------------------');
    console.log('='.repeat(60));

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
  seedLocalDatabase();
}

export { seedLocalDatabase };
