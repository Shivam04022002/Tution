"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDemoAccounts = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const User_1 = require("../models/User");
const ParentRequirement_1 = require("../models/ParentRequirement");
const TeacherProfile_1 = require("../models/TeacherProfile");
const TutorMatch_1 = require("../models/TutorMatch");
const TutorApplication_1 = require("../models/TutorApplication");
const DemoClass_1 = require("../models/DemoClass");
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
const generateId = (prefix) => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${prefix}-${timestamp}-${random}`.toUpperCase();
};
const hashPassword = async (password) => {
    const salt = await bcryptjs_1.default.genSalt(10);
    return bcryptjs_1.default.hash(password, salt);
};
const connectDB = async () => {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tuition_app';
    try {
        await mongoose_1.default.connect(mongoURI);
        console.log('✅ MongoDB Connected');
    }
    catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
};
const clearDemoData = async () => {
    console.log('\n🧹 Clearing existing demo data...');
    const parentUser = await User_1.User.findOne({ email: DEMO_PARENT.email });
    const teacherUser = await User_1.User.findOne({ email: DEMO_TEACHER.email });
    if (parentUser) {
        await ParentRequirement_1.ParentRequirement.deleteMany({ parentId: parentUser._id });
        await TutorMatch_1.TutorMatch.deleteMany({ parentId: parentUser._id });
        await TutorApplication_1.TutorApplication.deleteMany({ parentId: parentUser._id });
        await DemoClass_1.DemoClass.deleteMany({ parentId: parentUser._id });
        await User_1.User.findByIdAndDelete(parentUser._id);
        console.log('  🗑️  Deleted existing demo parent and related data');
    }
    if (teacherUser) {
        await TeacherProfile_1.TeacherProfile.deleteMany({ userId: teacherUser._id });
        await TutorMatch_1.TutorMatch.deleteMany({ teacherId: teacherUser._id });
        await TutorApplication_1.TutorApplication.deleteMany({ teacherId: teacherUser._id });
        await DemoClass_1.DemoClass.deleteMany({ teacherId: teacherUser._id });
        await User_1.User.findByIdAndDelete(teacherUser._id);
        console.log('  🗑️  Deleted existing demo teacher and related data');
    }
    if (!parentUser && !teacherUser) {
        console.log('  ℹ️  No existing demo data found');
    }
};
const createDemoParent = async () => {
    console.log('\n👤 Creating Demo Parent...');
    const hashedPassword = await hashPassword(DEMO_PARENT.password);
    const parentUser = new User_1.User({
        email: DEMO_PARENT.email,
        phoneNumber: DEMO_PARENT.mobileNumber,
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
    const requirement = new ParentRequirement_1.ParentRequirement({
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
const createDemoTeacher = async () => {
    console.log('\n👨‍🏫 Creating Demo Teacher...');
    const hashedPassword = await hashPassword(DEMO_TEACHER.password);
    const teacherUser = new User_1.User({
        email: DEMO_TEACHER.email,
        phoneNumber: DEMO_TEACHER.mobileNumber,
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
    const teacherProfile = new TeacherProfile_1.TeacherProfile({
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
            groupSize: 0,
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
            aadhaarCard: '',
            panCard: '',
            qualificationDocuments: [],
            portfolioPhotos: [],
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
const createTutorMatch = async (parentUser, requirement, teacherUser, teacherProfile) => {
    console.log('\n🔗 Creating TutorMatch...');
    const match = new TutorMatch_1.TutorMatch({
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
                requirementDays: ['Monday', 'Wednesday', 'Friday'],
                teacherDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
                requirementTimeSlots: ['Evening'],
                teacherTimeSlots: ['Morning', 'Afternoon', 'Evening'],
                dayOverlap: ['Monday', 'Wednesday', 'Friday'],
                timeOverlap: ['Evening'],
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
const createTutorApplication = async (requirement, teacherUser, teacherProfile, parentUser) => {
    console.log('\n📝 Creating TutorApplication...');
    const application = new TutorApplication_1.TutorApplication({
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
const createDemoClass = async (parentUser, teacherUser, teacherProfile, requirement, application) => {
    console.log('\n📅 Creating DemoClass...');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);
    const demoClass = new DemoClass_1.DemoClass({
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
            platform: 'In-Person',
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
const seedDemoAccounts = async () => {
    console.log('='.repeat(60));
    console.log('🌱 DEMO ACCOUNTS SEED SCRIPT');
    console.log('='.repeat(60));
    try {
        await connectDB();
        await clearDemoData();
        const { user: parentUser, requirement } = await createDemoParent();
        const { user: teacherUser, profile: teacherProfile } = await createDemoTeacher();
        const match = await createTutorMatch(parentUser, requirement, teacherUser, teacherProfile);
        const application = await createTutorApplication(requirement, teacherUser, teacherProfile, parentUser);
        const demoClass = await createDemoClass(parentUser, teacherUser, teacherProfile, requirement, application);
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
    }
    catch (error) {
        console.error('\n❌ SEED FAILED:', error);
        process.exit(1);
    }
    finally {
        await mongoose_1.default.disconnect();
        console.log('\n👋 MongoDB Disconnected');
        process.exit(0);
    }
};
exports.seedDemoAccounts = seedDemoAccounts;
if (require.main === module) {
    seedDemoAccounts();
}
//# sourceMappingURL=seedDemoAccounts.js.map