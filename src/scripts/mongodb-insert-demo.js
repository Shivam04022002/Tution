/**
 * MONGODB INSERT SCRIPT FOR DEMO ACCOUNTS
 * ========================================
 * 
 * Direct MongoDB insertion script for demo data.
 * Run this in MongoDB shell or use with mongosh.
 * 
 * Usage:
 *   mongosh "mongodb://localhost:27017/tuition_app" < src/scripts/mongodb-insert-demo.js
 * 
 * Or in MongoDB Compass:
 *   - Open MongoDB Compass
 *   - Connect to your database
 *   - Go to any collection
 *   - Click "ADD DATA" → "Import JSON or CSV file"
 *   - Import the generated files
 */

// ============================================
// CONFIGURATION
// ============================================
const DB_NAME = 'tuition_app'; // Change to your database name

// Demo Account Data
const DEMO_PARENT = {
  email: 'parent@test.com',
  mobileNumber: '9999999991',
  password: '$2a$10$YourHashedPasswordHere', // Replace with actual bcrypt hash
  role: 'parent',
  profile: {
    firstName: 'Demo',
    lastName: 'Parent',
    profileImage: null,
    dateOfBirth: null,
    gender: null
  },
  profileCompleted: true,
  onboardingCompleted: true,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

const DEMO_TEACHER = {
  email: 'teacher@test.com',
  mobileNumber: '9999999992',
  password: '$2a$10$YourHashedPasswordHere', // Replace with actual bcrypt hash
  role: 'teacher',
  profile: {
    firstName: 'Demo',
    lastName: 'Teacher',
    profileImage: null,
    dateOfBirth: new Date('1990-01-01'),
    gender: 'male'
  },
  profileCompleted: true,
  onboardingCompleted: true,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

// ============================================
// GENERATE UNIQUE IDs
// ============================================
function generateObjectId() {
  return new ObjectId();
}

function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}-${timestamp}-${random}`.toUpperCase();
}

// ============================================
// MAIN INSERTION FUNCTION
// ============================================
function insertDemoData() {
  const db = db.getSiblingDB(DB_NAME);
  
  print('='.repeat(60));
  print('🌱 INSERTING DEMO DATA INTO MONGODB');
  print('='.repeat(60));
  
  // Clean existing demo data
  print('\n🧹 Cleaning existing demo data...');
  
  const existingParent = db.users.findOne({ email: DEMO_PARENT.email });
  const existingTeacher = db.users.findOne({ email: DEMO_TEACHER.email });
  
  if (existingParent) {
    db.parentrequirements.deleteMany({ parentId: existingParent._id });
    db.tutormatches.deleteMany({ parentId: existingParent._id });
    db.tutorapplications.deleteMany({ parentId: existingParent._id });
    db.democlasses.deleteMany({ parentId: existingParent._id });
    db.users.deleteOne({ _id: existingParent._id });
    print('  🗑️  Deleted existing demo parent');
  }
  
  if (existingTeacher) {
    db.teacherprofiles.deleteMany({ userId: existingTeacher._id });
    db.tutormatches.deleteMany({ teacherId: existingTeacher._id });
    db.tutorapplications.deleteMany({ teacherId: existingTeacher._id });
    db.democlasses.deleteMany({ teacherId: existingTeacher._id });
    db.users.deleteOne({ _id: existingTeacher._id });
    print('  🗑️  Deleted existing demo teacher');
  }
  
  // ============================================
  // CREATE USERS
  // ============================================
  print('\n👤 Creating Users...');
  
  const parentId = generateObjectId();
  const teacherId = generateObjectId();
  
  // NOTE: Passwords need to be hashed with bcrypt before insertion
  // For testing, you can use a pre-hashed password or update after insertion
  // Example bcrypt hash for "Parent@123":
  const parentPasswordHash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; // "password" hash - REPLACE
  const teacherPasswordHash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; // "password" hash - REPLACE
  
  // Create Parent User
  const parentUser = {
    _id: parentId,
    email: DEMO_PARENT.email,
    phoneNumber: DEMO_PARENT.mobileNumber,
    password: parentPasswordHash,
    role: 'parent',
    profile: {
      firstName: 'Demo',
      lastName: 'Parent',
      profileImage: null,
      dateOfBirth: null,
      gender: null
    },
    profileCompleted: true,
    onboardingCompleted: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  db.users.insertOne(parentUser);
  print(`  ✅ Parent User created: ${parentId}`);
  
  // Create Teacher User
  const teacherUser = {
    _id: teacherId,
    email: DEMO_TEACHER.email,
    phoneNumber: DEMO_TEACHER.mobileNumber,
    password: teacherPasswordHash,
    role: 'teacher',
    profile: {
      firstName: 'Demo',
      lastName: 'Teacher',
      profileImage: null,
      dateOfBirth: new Date('1990-01-01'),
      gender: 'male'
    },
    profileCompleted: true,
    onboardingCompleted: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  db.users.insertOne(teacherUser);
  print(`  ✅ Teacher User created: ${teacherId}`);
  
  // ============================================
  // CREATE PARENT REQUIREMENT
  // ============================================
  print('\n📋 Creating ParentRequirement...');
  
  const requirementId = generateObjectId();
  const requirementIdStr = generateId('REQ');
  
  const parentRequirement = {
    _id: requirementId,
    parentId: parentId,
    requirementId: requirementIdStr,
    studentDetails: {
      studentName: 'Rahul',
      age: 15,
      grade: 'Class 10',
      board: 'CBSE',
      schoolName: 'Demo School',
      genderPreference: 'any',
      multipleChildren: false
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
        longitude: 80.3319
      },
      teachingRadius: 5
    },
    schedule: {
      daysPerWeek: '3',
      preferredTimings: ['Evening'],
      startDate: new Date().toISOString().split('T')[0]
    },
    tutorPreferences: 'Experienced tutor preferred',
    budget: {
      minAmount: 4000,
      maxAmount: 5000,
      negotiationAllowed: true
    },
    status: 'active',
    priority: 'medium',
    matchedTutors: [],
    totalMatches: 0,
    views: 0,
    unlocks: 0,
    isActive: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  db.parentrequirements.insertOne(parentRequirement);
  print(`  ✅ ParentRequirement created: ${requirementIdStr}`);
  
  // ============================================
  // CREATE TEACHER PROFILE
  // ============================================
  print('\n👨‍🏫 Creating TeacherProfile...');
  
  const teacherProfileId = generateObjectId();
  
  const teacherProfile = {
    _id: teacherProfileId,
    userId: teacherId,
    basicDetails: {
      fullName: 'Demo Teacher',
      gender: 'male',
      dateOfBirth: new Date('1990-01-01'),
      mobileNumber: '9999999992',
      email: 'teacher@test.com',
      languages: ['English', 'Hindi'],
      profilePhoto: ''
    },
    education: {
      highestQualification: 'B.Tech',
      degree: 'B.Tech',
      university: 'IIT Kanpur',
      yearOfCompletion: 2015,
      certifications: [],
      status: 'completed'
    },
    teachingDetails: {
      subjects: ['Mathematics', 'Science'],
      classes: ['Class 8', 'Class 9', 'Class 10'],
      boards: ['CBSE', 'State Board'],
      specialization: 'Mathematics',
      teachingModes: ['student_home', 'online'],
      groupTuitionOption: false,
      groupSize: 0,
      groupRate: 0
    },
    locationAvailability: {
      address: '456 Teacher Colony, Kanpur',
      city: 'Kanpur',
      pincode: '208002',
      coordinates: {
        latitude: 26.4600,
        longitude: 80.3500
      },
      preferredAreas: ['Kanpur', 'Kidwai Nagar', 'Geeta Nagar'],
      teachingRadius: 10,
      availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      availableTimeSlots: ['Morning', 'Afternoon', 'Evening'],
      vacationMode: false
    },
    bio: 'Experienced Mathematics and Science teacher with 5+ years of teaching experience. Specializes in CBSE curriculum for classes 8-10.',
    pricingRevenue: {
      hourlyRate: 500,
      monthlyRate: 5000,
      currentRevenue: '0',
      experienceYears: 5,
      pricingStrategy: 'competitive',
      negotiationAllowed: true
    },
    verificationDocuments: {
      aadhaarCard: '',
      panCard: '',
      qualificationDocuments: [],
      portfolioPhotos: []
    },
    verificationStatus: 'approved',
    stats: {
      totalStudents: 0,
      activeStudents: 0,
      completedClasses: 0,
      averageRating: 4.8,
      totalReviews: 12,
      totalEarnings: 0,
      leadUnlocks: 0,
      responseRate: 95,
      responseTime: '15 min'
    },
    preferences: {
      notifications: true,
      whatsappUpdates: true,
      emailUpdates: true,
      leadAlerts: true
    },
    isActive: true,
    isVerified: true,
    isBlocked: false,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  db.teacherprofiles.insertOne(teacherProfile);
  print(`  ✅ TeacherProfile created: ${teacherProfileId}`);
  
  // ============================================
  // CREATE TUTOR MATCH
  // ============================================
  print('\n🔗 Creating TutorMatch...');
  
  const matchId = generateObjectId();
  const matchIdStr = generateId('MAT');
  
  const tutorMatch = {
    _id: matchId,
    requirementId: requirementId,
    teacherId: teacherId,
    teacherProfileId: teacherProfileId,
    parentId: parentId,
    matchId: matchIdStr,
    overallScore: 92,
    breakdown: {
      subjectScore: 100,
      subjectMatchDetails: {
        requirementSubjects: ['Mathematics', 'Science'],
        teacherSubjects: ['Mathematics', 'Science'],
        matchedSubjects: ['Mathematics', 'Science'],
        matchPercentage: 100
      },
      classScore: 100,
      classMatchDetails: {
        requirementGrade: 'Class 10',
        teacherClasses: ['Class 8', 'Class 9', 'Class 10'],
        isMatch: true
      },
      boardScore: 100,
      boardMatchDetails: {
        requirementBoard: 'CBSE',
        teacherBoards: ['CBSE', 'State Board'],
        isMatch: true
      },
      locationScore: 95,
      locationMatchDetails: {
        requirementCity: 'Kanpur',
        teacherCity: 'Kanpur',
        requirementPincode: '208001',
        teacherPincode: '208002',
        distance: 2.5,
        teachingRadius: 10,
        isWithinRadius: true
      },
      budgetScore: 100,
      budgetMatchDetails: {
        requirementMinBudget: 4000,
        requirementMaxBudget: 5000,
        teacherHourlyRate: 500,
        isWithinBudget: true
      },
      modeScore: 100,
      modeMatchDetails: {
        requirementMode: 'home',
        teacherModes: ['student_home', 'online'],
        isMatch: true
      },
      timingScore: 90,
      timingMatchDetails: {
        requirementDays: ['Monday', 'Wednesday', 'Friday'],
        teacherDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        requirementTimeSlots: ['Evening'],
        teacherTimeSlots: ['Morning', 'Afternoon', 'Evening'],
        dayOverlap: ['Monday', 'Wednesday', 'Friday'],
        timeOverlap: ['Evening']
      }
    },
    algorithmVersion: 'v1.0',
    status: 'recommended',
    expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  db.tutormatches.insertOne(tutorMatch);
  print(`  ✅ TutorMatch created: ${matchIdStr} (Score: 92%)`);
  
  // ============================================
  // CREATE TUTOR APPLICATION
  // ============================================
  print('\n📝 Creating TutorApplication...');
  
  const applicationId = generateObjectId();
  const applicationIdStr = generateId('APP');
  
  const tutorApplication = {
    _id: applicationId,
    parentRequirementId: requirementId,
    teacherId: teacherId,
    teacherProfileId: teacherProfileId,
    parentId: parentId,
    applicationId: applicationIdStr,
    status: 'pending',
    message: 'I would love to teach Rahul Mathematics and Science. I have 5 years of experience with CBSE curriculum and have helped many students score 90+ in board exams.',
    proposedFee: 4800,
    proposedSchedule: {
      daysPerWeek: '3',
      preferredTimeSlots: ['Evening (5 PM - 7 PM)']
    },
    viewedByParent: false,
    demoScheduled: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  db.tutorapplications.insertOne(tutorApplication);
  print(`  ✅ TutorApplication created: ${applicationIdStr} (Status: pending)`);
  
  // ============================================
  // CREATE DEMO CLASS
  // ============================================
  print('\n📅 Creating DemoClass...');
  
  const demoClassId = generateObjectId();
  const demoIdStr = generateId('DEMO');
  
  // Schedule for tomorrow at 5 PM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(17, 0, 0, 0);
  
  const demoClass = {
    _id: demoClassId,
    demoId: demoIdStr,
    parentId: parentId,
    teacherId: teacherId,
    teacherProfileId: teacherProfileId,
    requirementId: requirementId,
    applicationId: applicationId,
    studentDetails: {
      studentName: 'Rahul',
      grade: 'Class 10',
      subject: 'Mathematics'
    },
    scheduledDate: tomorrow,
    scheduledTime: '5:00 PM',
    duration: 60,
    mode: 'offline',
    meetingDetails: {
      platform: 'In-Person',
      address: '123 Demo Street, Kanpur'
    },
    status: 'scheduled',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  db.democlasses.insertOne(demoClass);
  print(`  ✅ DemoClass created: ${demoIdStr}`);
  print(`     Scheduled: ${tomorrow.toDateString()} at 5:00 PM`);
  
  // ============================================
  // UPDATE REQUIREMENT WITH MATCH
  // ============================================
  print('\n📝 Updating ParentRequirement with match...');
  
  db.parentrequirements.updateOne(
    { _id: requirementId },
    {
      $set: {
        totalMatches: 1,
        matchedTutors: [{
          tutorId: teacherId,
          matchScore: 92,
          matchedAt: new Date()
        }]
      }
    }
  );
  print(`  ✅ ParentRequirement updated with match`);
  
  // ============================================
  // UPDATE APPLICATION WITH DEMO ID
  // ============================================
  print('\n📝 Updating TutorApplication with demo...');
  
  db.tutorapplications.updateOne(
    { _id: applicationId },
    {
      $set: {
        demoScheduled: true,
        demoId: demoClassId
      }
    }
  );
  print(`  ✅ TutorApplication updated with demo reference`);
  
  // ============================================
  // SUMMARY
  // ============================================
  print('\n' + '='.repeat(60));
  print('✅ DEMO DATA INSERTED SUCCESSFULLY');
  print('='.repeat(60));
  print('\n📊 SUMMARY:');
  print(`  • Demo Parent: parent@test.com / Parent@123`);
  print(`    User ID: ${parentId}`);
  print(`  • Demo Teacher: teacher@test.com / Teacher@123`);
  print(`    User ID: ${teacherId}`);
  print(`  • TutorMatch: ${matchIdStr} (Score: 92%)`);
  print(`  • TutorApplication: ${applicationIdStr} (Status: pending)`);
  print(`  • DemoClass: ${demoIdStr} (Status: scheduled)`);
  print(`    Date: ${tomorrow.toDateString()} at 5:00 PM`);
  print('\n🔑 LOGIN CREDENTIALS:');
  print('  Parent Dashboard:');
  print('    Email: parent@test.com');
  print('    Password: Parent@123');
  print('  Teacher Dashboard:');
  print('    Email: teacher@test.com');
  print('    Password: Teacher@123');
  print('\n⚠️  NOTE: Passwords need to be hashed with bcrypt!');
  print('   Update the password field in users collection with:');
  print('   bcrypt.hashSync("Parent@123", 10) for parent');
  print('   bcrypt.hashSync("Teacher@123", 10) for teacher');
  print('='.repeat(60));
}

// Execute insertion
insertDemoData();
