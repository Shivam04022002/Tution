"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDuplicate = exports.signup = exports.registerComplete = exports.login = exports.logout = exports.updateProfile = exports.getCurrentUser = exports.verifyOTP = exports.sendOTP = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const firebase_1 = require("../config/firebase");
const User_1 = require("../models/User");
const ParentRequirement_1 = require("../models/ParentRequirement");
const TeacherProfile_1 = require("../models/TeacherProfile");
const generateToken = (userId) => {
    return jsonwebtoken_1.default.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '7d',
    });
};
const sendOTP = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required',
            });
        }
        const existingUser = await User_1.User.findOne({ phoneNumber });
        try {
            await firebase_1.auth.createUser({
                phoneNumber,
            });
        }
        catch (error) {
            if (error.code === 'auth/user-already-exists') {
                return res.status(200).json({
                    success: true,
                    message: 'OTP sent successfully',
                    userExists: true,
                });
            }
        }
        return res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            userExists: !!existingUser,
        });
    }
    catch (error) {
        console.error('Send OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to send OTP',
        });
    }
};
exports.sendOTP = sendOTP;
const verifyOTP = async (req, res) => {
    try {
        const { phoneNumber, otp, role } = req.body;
        if (!phoneNumber || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and OTP are required',
            });
        }
        if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
            return res.status(401).json({
                success: false,
                message: 'Invalid OTP format. OTP must be 6 digits.',
            });
        }
        let firebaseUser;
        try {
            firebaseUser = await firebase_1.auth.verifyPhoneNumber(phoneNumber, otp);
        }
        catch (error) {
            console.error('OTP verification failed:', error.message);
            if (error.message.includes('Invalid OTP') || error.message.includes('auth/invalid-verification-code')) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid OTP. Please try again.',
                });
            }
            if (error.message.includes('expired') || error.message.includes('auth/code-expired')) {
                return res.status(401).json({
                    success: false,
                    message: 'OTP has expired. Please request a new one.',
                });
            }
            if (error.message.includes('too many') || error.message.includes('auth/too-many-requests')) {
                return res.status(429).json({
                    success: false,
                    message: 'Too many attempts. Please try again later.',
                });
            }
            return res.status(401).json({
                success: false,
                message: 'OTP verification failed. Please try again.',
            });
        }
        let user = await User_1.User.findOne({ firebaseUid: firebaseUser.uid });
        if (!user) {
            if (!role) {
                return res.status(400).json({
                    success: false,
                    message: 'Role is required for new users. Please specify parent or teacher.',
                });
            }
            if (!['parent', 'teacher'].includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid role. Only parent and teacher roles can be created via OTP.',
                });
            }
            user = new User_1.User({
                firebaseUid: firebaseUser.uid,
                phoneNumber,
                email: `${phoneNumber}@tuition.app`,
                role,
                profile: {
                    firstName: '',
                    lastName: '',
                },
            });
            await user.save();
        }
        const token = generateToken(user._id.toString());
        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                firebaseUid: user.firebaseUid,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                profile: user.profile,
                profileCompleted: user.profileCompleted,
                onboardingCompleted: user.onboardingCompleted,
            },
        });
    }
    catch (error) {
        console.error('Verify OTP error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify OTP',
        });
    }
};
exports.verifyOTP = verifyOTP;
const getCurrentUser = async (req, res) => {
    try {
        const user = req.user;
        return res.status(200).json({
            success: true,
            user: {
                id: user._id,
                firebaseUid: user.firebaseUid,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                profile: user.profile,
                profileCompleted: user.profileCompleted,
                onboardingCompleted: user.onboardingCompleted,
                preferences: user.preferences,
                isVerified: user.isVerified,
            },
        });
    }
    catch (error) {
        console.error('Get current user error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get user information',
        });
    }
};
exports.getCurrentUser = getCurrentUser;
const updateProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const updates = req.body;
        const allowedUpdates = [
            'profile.firstName',
            'profile.lastName',
            'profile.dateOfBirth',
            'profile.gender',
            'profile.profileImage',
            'preferences',
        ];
        const updateData = {};
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key) || allowedUpdates.some(allowed => key.startsWith(allowed + '.'))) {
                updateData[key] = updates[key];
            }
        });
        const user = await User_1.User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                firebaseUid: user.firebaseUid,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                profile: user.profile,
                profileCompleted: user.profileCompleted,
                onboardingCompleted: user.onboardingCompleted,
                preferences: user.preferences,
            },
        });
    }
    catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update profile',
        });
    }
};
exports.updateProfile = updateProfile;
const logout = async (req, res) => {
    try {
        return res.status(200).json({
            success: true,
            message: 'Logout successful',
        });
    }
    catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to logout',
        });
    }
};
exports.logout = logout;
const login = async (req, res) => {
    try {
        const { emailOrMobile, password } = req.body;
        if (!emailOrMobile || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email/Mobile and password are required',
            });
        }
        const user = await User_1.User.findOne({
            $or: [
                { email: emailOrMobile.toLowerCase() },
                { phoneNumber: emailOrMobile },
            ],
        }).select('+password');
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials',
            });
        }
        if (!user.isActive) {
            return res.status(401).json({
                success: false,
                message: 'Account is deactivated',
            });
        }
        const token = generateToken(user._id.toString());
        return res.status(200).json({
            success: true,
            message: 'Login successful',
            token,
            role: user.role,
            user: {
                id: user._id,
                firebaseUid: user.firebaseUid,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                profile: user.profile,
                profileCompleted: user.profileCompleted,
                onboardingCompleted: user.onboardingCompleted,
            },
        });
    }
    catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to login',
        });
    }
};
exports.login = login;
const generateRequirementId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `REQ-${timestamp}-${random}`.toUpperCase();
};
const registerComplete = async (req, res) => {
    try {
        const { role, fullName, mobileNumber, email, password, parentDetails, studentDetails, tuitionRequirement, locationDetails, budgetDetails, scheduleDetails, tutorPreferences, personalDetails, educationDetails, professionalDetails, teachingDetails, teachingMode, availability, locationPreferences, pricingDetails, } = req.body;
        if (!role || !fullName || !mobileNumber || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Role, full name, mobile number, email, and password are required',
            });
        }
        if (!['parent', 'teacher'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Must be parent or teacher',
            });
        }
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters',
            });
        }
        const existingUser = await User_1.User.findOne({
            $or: [{ email: email.toLowerCase() }, { phoneNumber: mobileNumber }],
        });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User with this email or mobile number already exists',
            });
        }
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';
        const user = new User_1.User({
            email: email.toLowerCase(),
            phoneNumber: mobileNumber,
            password,
            role,
            profile: {
                firstName,
                lastName,
            },
            profileCompleted: true,
            onboardingCompleted: true,
        });
        await user.save();
        let profileData = null;
        console.log('=== REGISTER-COMPLETE DEBUG ===');
        console.log('studentDetails:', JSON.stringify(studentDetails, null, 2));
        console.log('tuitionRequirement:', JSON.stringify(tuitionRequirement, null, 2));
        console.log('scheduleDetails:', JSON.stringify(scheduleDetails, null, 2));
        console.log('locationDetails:', JSON.stringify(locationDetails, null, 2));
        console.log('=== END DEBUG ===');
        if (role === 'parent') {
            let minAmount = 0;
            let maxAmount = 0;
            if (budgetDetails?.budget === 'Custom Budget' && budgetDetails?.customBudget) {
                minAmount = 0;
                maxAmount = parseInt(budgetDetails.customBudget, 10) || 0;
            }
            else {
                const budgetMap = {
                    '₹1000 - ₹2000': { min: 1000, max: 2000 },
                    '₹2000 - ₹5000': { min: 2000, max: 5000 },
                    '₹5000 - ₹10000': { min: 5000, max: 10000 },
                    '₹10000+': { min: 10000, max: 50000 },
                };
                const budget = budgetMap[budgetDetails?.budget] || { min: 0, max: 0 };
                minAmount = budget.min;
                maxAmount = budget.max;
            }
            let tuitionType = 'home';
            if (tuitionRequirement?.tuitionType) {
                tuitionType = tuitionRequirement.tuitionType;
            }
            else if (tuitionRequirement?.tuitionMode) {
                const modeMap = {
                    'Home Tuition': 'home',
                    'Online Tuition': 'online',
                    'Group Tuition': 'group',
                    'Crash Course': 'crash',
                };
                tuitionType = modeMap[tuitionRequirement.tuitionMode] || 'home';
            }
            const parentRequirement = new ParentRequirement_1.ParentRequirement({
                parentId: user._id,
                requirementId: generateRequirementId(),
                studentDetails: {
                    studentName: studentDetails?.studentName || '',
                    age: parseInt(studentDetails?.age, 10) || 0,
                    grade: studentDetails?.grade || studentDetails?.className || '',
                    board: studentDetails?.board || tuitionRequirement?.board || '',
                    schoolName: studentDetails?.schoolName || '',
                    genderPreference: studentDetails?.gender?.toLowerCase() || 'any',
                    multipleChildren: false,
                },
                subjects: tuitionRequirement?.subjects || [],
                languagePreference: ['English'],
                tuitionType,
                location: {
                    address: locationDetails?.address || '',
                    city: locationDetails?.city || '',
                    pincode: locationDetails?.pincode || '',
                    coordinates: {
                        latitude: parseFloat(locationDetails?.latitude) || 0,
                        longitude: parseFloat(locationDetails?.longitude) || 0,
                    },
                    teachingRadius: parseInt(locationDetails?.teachingRadius) || 5,
                },
                schedule: {
                    daysPerWeek: scheduleDetails?.daysPerWeek || '3',
                    preferredTimings: scheduleDetails?.preferredTimings ||
                        (tuitionRequirement?.preferredTiming ? [tuitionRequirement.preferredTiming] : []),
                    startDate: scheduleDetails?.startDate || new Date().toISOString().split('T')[0],
                },
                tutorPreferences: tutorPreferences || '',
                budget: {
                    minAmount: minAmount || 0,
                    maxAmount: maxAmount || 0,
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
            });
            await parentRequirement.save();
            profileData = parentRequirement;
        }
        else if (role === 'teacher') {
            const experienceMap = {
                'Fresher': 0,
                '0-1 Years': 0.5,
                '1-3 Years': 2,
                '3-5 Years': 4,
                '5-10 Years': 7.5,
                '10+ Years': 12,
            };
            let monthlyRate = 0;
            let hourlyRate = 0;
            if (pricingDetails?.pricing === 'Custom Amount') {
                monthlyRate = parseInt(pricingDetails.customAmount) || 0;
            }
            else {
                const range = pricingDetails?.pricing?.replace('₹', '').split('-');
                if (range && range.length === 2) {
                    monthlyRate = (parseInt(range[0]) + parseInt(range[1])) / 2;
                }
                else if (pricingDetails?.pricing?.includes('10000+')) {
                    monthlyRate = 10000;
                }
            }
            hourlyRate = Math.round(monthlyRate / 40);
            const teacherProfile = new TeacherProfile_1.TeacherProfile({
                userId: user._id,
                basicDetails: {
                    fullName: personalDetails?.fullName || fullName,
                    gender: (personalDetails?.gender || '').toLowerCase(),
                    dateOfBirth: personalDetails?.dob ? new Date(personalDetails.dob) : new Date(),
                    mobileNumber: personalDetails?.mobileNumber || mobileNumber,
                    email: personalDetails?.email || email,
                    languages: ['English', 'Hindi'],
                    profilePhoto: '',
                },
                education: {
                    highestQualification: educationDetails?.qualification || '',
                    degree: educationDetails?.qualification || '',
                    university: educationDetails?.collegeUniversity || '',
                    yearOfCompletion: new Date().getFullYear(),
                    certifications: [],
                    status: 'completed',
                },
                teachingDetails: {
                    subjects: teachingDetails?.subjects || [],
                    classes: teachingDetails?.classes || [],
                    boards: teachingDetails?.boards || [],
                    specialization: teachingDetails?.subjects?.[0] || '',
                    teachingModes: (teachingMode || []).map((m) => {
                        const modeMap = {
                            'Home Tuition': 'student_home',
                            'Online Tuition': 'online',
                            'Group Tuition': 'group',
                            'Institute Tuition': 'own_home',
                        };
                        return modeMap[m] || m.toLowerCase().replace(' ', '_');
                    }),
                    groupTuitionOption: teachingMode?.includes('Group Tuition') || false,
                    groupSize: 5,
                    groupRate: 0,
                },
                locationAvailability: {
                    address: personalDetails?.address || '',
                    city: personalDetails?.city || '',
                    pincode: personalDetails?.pincode || '',
                    coordinates: { latitude: 0, longitude: 0 },
                    preferredAreas: locationPreferences || [],
                    teachingRadius: 10,
                    availableDays: availability?.days || [],
                    availableTimeSlots: availability?.timeSlots || [],
                    vacationMode: false,
                },
                bio: professionalDetails?.bio || '',
                pricingRevenue: {
                    hourlyRate,
                    monthlyRate,
                    currentRevenue: '0',
                    experienceYears: experienceMap[professionalDetails?.teachingExperience] || 0,
                    pricingStrategy: 'competitive',
                    negotiationAllowed: true,
                },
                verificationDocuments: {
                    aadhaarCard: '',
                    panCard: '',
                    qualificationDocuments: [],
                    portfolioPhotos: [],
                },
                verificationStatus: 'pending',
                stats: {
                    totalStudents: 0,
                    activeStudents: 0,
                    completedClasses: 0,
                    averageRating: 0,
                    totalReviews: 0,
                    totalEarnings: 0,
                    leadUnlocks: 0,
                    responseRate: 0,
                    responseTime: '30 min',
                },
                preferences: {
                    notifications: true,
                    whatsappUpdates: true,
                    emailUpdates: true,
                    leadAlerts: true,
                },
                isActive: true,
                isVerified: false,
                isBlocked: false,
            });
            await teacherProfile.save();
            profileData = teacherProfile;
        }
        const token = generateToken(user._id.toString());
        return res.status(201).json({
            success: true,
            message: 'Account created successfully',
            token,
            user: {
                id: user._id,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                profile: user.profile,
                profileCompleted: user.profileCompleted,
                onboardingCompleted: user.onboardingCompleted,
            },
            profile: profileData,
        });
    }
    catch (error) {
        console.error('Complete registration error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create account',
            error: error.message,
        });
    }
};
exports.registerComplete = registerComplete;
const signup = async (req, res) => {
    try {
        const { role, fullName, mobileNumber, email, password } = req.body;
        if (!role || !fullName || !mobileNumber || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required',
            });
        }
        if (!['parent', 'teacher'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role. Only parent and teacher roles can be created via signup.',
            });
        }
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters',
            });
        }
        const existingUser = await User_1.User.findOne({
            $or: [{ email: email.toLowerCase() }, { phoneNumber: mobileNumber }],
        });
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User with this email or mobile number already exists',
            });
        }
        const nameParts = fullName.trim().split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || '';
        const user = new User_1.User({
            email: email.toLowerCase(),
            phoneNumber: mobileNumber,
            password,
            role,
            profile: {
                firstName,
                lastName,
            },
            profileCompleted: true,
            onboardingCompleted: false,
        });
        await user.save();
        const token = generateToken(user._id.toString());
        return res.status(201).json({
            success: true,
            message: 'Account created successfully',
            token,
            user: {
                id: user._id,
                email: user.email,
                phoneNumber: user.phoneNumber,
                role: user.role,
                profile: user.profile,
                profileCompleted: user.profileCompleted,
                onboardingCompleted: user.onboardingCompleted,
            },
        });
    }
    catch (error) {
        console.error('Signup error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create account',
        });
    }
};
exports.signup = signup;
const checkDuplicate = async (req, res) => {
    try {
        const { email, mobileNumber } = req.body;
        if (!email && !mobileNumber) {
            return res.status(400).json({
                success: false,
                message: 'Email or mobile number is required',
            });
        }
        const query = {};
        if (email)
            query.email = email.toLowerCase();
        if (mobileNumber)
            query.phoneNumber = mobileNumber;
        const existingUser = await User_1.User.findOne({
            $or: Object.keys(query).map((key) => ({ [key]: query[key] })),
        });
        return res.status(200).json({
            success: true,
            exists: !!existingUser,
            message: existingUser ? 'Account already exists' : 'Account available',
        });
    }
    catch (error) {
        console.error('Check duplicate error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to check account availability',
        });
    }
};
exports.checkDuplicate = checkDuplicate;
//# sourceMappingURL=authController.js.map