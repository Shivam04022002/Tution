"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRecommendedRequirements = exports.getRequirementById = exports.hideRequirement = exports.unsaveRequirement = exports.saveRequirement = exports.getRequirementMatchAnalysis = exports.getAvailableRequirements = exports.getMatchingEligibility = exports.updateDiscoverability = exports.getDiscoverability = exports.updateAvailability = exports.getAvailability = exports.uploadDocuments = exports.updatePreferences = exports.getPreferences = exports.getClasses = exports.getSubjects = exports.getProfileCompletion = exports.toggleVacationMode = exports.getTeacherStats = exports.getTeacherGallery = exports.getTeacherById = exports.getAllTeachers = exports.updateTeacherProfile = exports.getTeacherProfile = exports.registerTeacher = void 0;
const TeacherProfile_1 = require("../models/TeacherProfile");
const User_1 = require("../models/User");
const ParentRequirement_1 = require("../models/ParentRequirement");
const TutorMatch_1 = require("../models/TutorMatch");
const cloudinary_1 = require("cloudinary");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const registerTeacher = async (req, res) => {
    try {
        const userId = req.user?._id;
        const firebaseUid = req.user?.firebaseUid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const existingProfile = await TeacherProfile_1.TeacherProfile.findOne({ userId });
        if (existingProfile) {
            return res.status(400).json({
                success: false,
                message: 'Teacher profile already exists',
            });
        }
        const { personalDetails, educationDetails, professionalDetails, teachingDetails, teachingMode, availability, locationPreferences, pricingDetails, } = req.body;
        const files = req.files;
        let profilePictureUrl = personalDetails?.profilePicture || '';
        let aadhaarDocumentUrl = '';
        const certificateUrls = [];
        if (files) {
            if (files.profilePicture && files.profilePicture[0]) {
                const result = await cloudinary_1.v2.uploader.upload(files.profilePicture[0].path, {
                    folder: 'teachers/profile-pictures',
                    public_id: `profile_${firebaseUid}`,
                });
                profilePictureUrl = result.secure_url;
            }
            if (files.aadhaarDocument && files.aadhaarDocument[0]) {
                const result = await cloudinary_1.v2.uploader.upload(files.aadhaarDocument[0].path, {
                    folder: 'teachers/documents',
                    public_id: `aadhaar_${firebaseUid}`,
                });
                aadhaarDocumentUrl = result.secure_url;
            }
            if (files.certificates && files.certificates.length > 0) {
                for (let i = 0; i < files.certificates.length; i++) {
                    const result = await cloudinary_1.v2.uploader.upload(files.certificates[i].path, {
                        folder: 'teachers/certificates',
                        public_id: `certificate_${firebaseUid}_${i}`,
                    });
                    certificateUrls.push(result.secure_url);
                }
            }
        }
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
            userId,
            basicDetails: {
                fullName: personalDetails?.fullName,
                gender: personalDetails?.gender?.toLowerCase(),
                dateOfBirth: personalDetails?.dob ? new Date(personalDetails.dob) : new Date(),
                mobileNumber: personalDetails?.mobileNumber,
                email: personalDetails?.email,
                languages: ['English', 'Hindi'],
                profilePhoto: profilePictureUrl,
            },
            education: {
                highestQualification: educationDetails?.qualification,
                degree: educationDetails?.qualification,
                university: educationDetails?.collegeUniversity || '',
                yearOfCompletion: new Date().getFullYear(),
                certifications: certificateUrls.map((url, index) => ({
                    name: `Certificate ${index + 1}`,
                    issuer: 'Unknown',
                    year: new Date().getFullYear(),
                    certificateUrl: url,
                })),
                status: 'completed',
            },
            teachingDetails: {
                subjects: teachingDetails?.subjects || [],
                classes: teachingDetails?.classes || [],
                boards: teachingDetails?.boards || [],
                specialization: teachingDetails?.subjects?.[0] || '',
                teachingModes: (teachingMode || []).map((mode) => {
                    const modeMap = {
                        'Home Tuition': 'student_home',
                        'Online Tuition': 'online',
                        'Group Tuition': 'group',
                        'Institute Tuition': 'own_home',
                    };
                    return modeMap[mode] || mode.toLowerCase().replace(' ', '_');
                }),
                groupTuitionOption: teachingMode?.includes('Group Tuition') || false,
                groupSize: 5,
                groupRate: 0,
            },
            locationAvailability: {
                address: personalDetails?.address,
                city: personalDetails?.city,
                pincode: personalDetails?.pincode,
                coordinates: {
                    latitude: 0,
                    longitude: 0,
                },
                preferredAreas: locationPreferences || [],
                preferredLocations: [],
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
                aadhaarCard: aadhaarDocumentUrl,
                panCard: '',
                qualificationDocuments: certificateUrls,
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
        await User_1.User.findByIdAndUpdate(userId, {
            profileCompleted: true,
            'profile.firstName': personalDetails?.fullName?.split(' ')[0] || '',
            'profile.lastName': personalDetails?.fullName?.split(' ').slice(1).join(' ') || '',
        });
        return res.status(201).json({
            success: true,
            message: 'Teacher registration submitted successfully. Your profile is under review.',
            data: {
                teacherId: teacherProfile._id,
                verificationStatus: teacherProfile.verificationStatus,
                isProfileComplete: teacherProfile.isProfileComplete || false,
            },
        });
    }
    catch (error) {
        console.error('Teacher registration error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to register teacher',
            error: error.message,
        });
    }
};
exports.registerTeacher = registerTeacher;
const getTeacherProfile = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const teacherProfile = await TeacherProfile_1.TeacherProfile.findOne({ userId })
            .populate('userId', 'email phoneNumber role isActive')
            .lean();
        if (!teacherProfile) {
            return res.status(404).json({
                success: false,
                message: 'Teacher profile not found',
            });
        }
        return res.status(200).json({
            success: true,
            data: teacherProfile,
        });
    }
    catch (error) {
        console.error('Get teacher profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get teacher profile',
            error: error.message,
        });
    }
};
exports.getTeacherProfile = getTeacherProfile;
const updateTeacherProfile = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const teacherProfile = await TeacherProfile_1.TeacherProfile.findOne({ userId });
        if (!teacherProfile) {
            return res.status(404).json({
                success: false,
                message: 'Teacher profile not found',
            });
        }
        const allowedUpdates = [
            'basicDetails.fullName',
            'basicDetails.gender',
            'basicDetails.dateOfBirth',
            'basicDetails.languages',
            'basicDetails.profilePhoto',
            'education.highestQualification',
            'education.university',
            'education.certifications',
            'teachingDetails.subjects',
            'teachingDetails.classes',
            'teachingDetails.boards',
            'teachingDetails.specialization',
            'teachingDetails.teachingModes',
            'teachingDetails.groupTuitionOption',
            'teachingDetails.groupSize',
            'locationAvailability.address',
            'locationAvailability.preferredAreas',
            'locationAvailability.availableDays',
            'locationAvailability.availableTimeSlots',
            'locationAvailability.vacationMode',
            'pricingRevenue.hourlyRate',
            'pricingRevenue.monthlyRate',
            'pricingRevenue.negotiationAllowed',
            'preferences',
            'bio',
        ];
        const updates = req.body;
        const updateData = {};
        Object.keys(updates).forEach((key) => {
            if (allowedUpdates.includes(key) || allowedUpdates.some((allowed) => key.startsWith(allowed + '.'))) {
                updateData[key] = updates[key];
            }
        });
        const files = req.files;
        if (files?.profilePicture?.[0]) {
            const result = await cloudinary_1.v2.uploader.upload(files.profilePicture[0].path, {
                folder: 'teachers/profile-pictures',
                public_id: `profile_${req.user?.firebaseUid}_${Date.now()}`,
            });
            updateData['basicDetails.profilePhoto'] = result.secure_url;
        }
        const updatedProfile = await TeacherProfile_1.TeacherProfile.findOneAndUpdate({ userId }, { $set: updateData }, { new: true, runValidators: true });
        return res.status(200).json({
            success: true,
            message: 'Teacher profile updated successfully',
            data: updatedProfile,
        });
    }
    catch (error) {
        console.error('Update teacher profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update teacher profile',
            error: error.message,
        });
    }
};
exports.updateTeacherProfile = updateTeacherProfile;
const getAllTeachers = async (req, res) => {
    try {
        const { city, subjects, classes, boards, teachingMode, minRating, maxPrice, page = 1, limit = 10, } = req.query;
        const query = {
            isActive: true,
            isVerified: true,
            isBlocked: false,
        };
        if (city) {
            query['locationAvailability.city'] = { $regex: city, $options: 'i' };
        }
        if (subjects) {
            const subjectList = subjects.split(',');
            query['teachingDetails.subjects'] = { $in: subjectList };
        }
        if (classes) {
            const classList = classes.split(',');
            query['teachingDetails.classes'] = { $in: classList };
        }
        if (boards) {
            const boardList = boards.split(',');
            query['teachingDetails.boards'] = { $in: boardList };
        }
        if (teachingMode) {
            query['teachingDetails.teachingModes'] = teachingMode;
        }
        if (minRating) {
            query['stats.averageRating'] = { $gte: parseFloat(minRating) };
        }
        if (maxPrice) {
            query['pricingRevenue.monthlyRate'] = { $lte: parseInt(maxPrice) };
        }
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const teachers = await TeacherProfile_1.TeacherProfile.find(query)
            .select('-verificationDocuments.aadhaarCard -verificationDocuments.panCard')
            .skip(skip)
            .limit(limitNum)
            .sort({ 'stats.averageRating': -1, createdAt: -1 })
            .lean();
        const total = await TeacherProfile_1.TeacherProfile.countDocuments(query);
        return res.status(200).json({
            success: true,
            data: teachers,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    }
    catch (error) {
        console.error('Get all teachers error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get teachers',
            error: error.message,
        });
    }
};
exports.getAllTeachers = getAllTeachers;
const getTeacherById = async (req, res) => {
    try {
        const { id } = req.params;
        const teacher = await TeacherProfile_1.TeacherProfile.findById(id)
            .select('-verificationDocuments.aadhaarCard -verificationDocuments.panCard -verificationDocuments.qualificationDocuments')
            .lean();
        if (!teacher || !teacher.isActive || teacher.isBlocked) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found',
            });
        }
        return res.status(200).json({
            success: true,
            data: teacher,
        });
    }
    catch (error) {
        console.error('Get teacher by ID error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get teacher',
            error: error.message,
        });
    }
};
exports.getTeacherById = getTeacherById;
const getTeacherGallery = async (req, res) => {
    try {
        const { id } = req.params;
        const teacher = await TeacherProfile_1.TeacherProfile.findById(id)
            .select('verificationDocuments.qualificationDocuments verificationDocuments.portfolioPhotos verificationDocuments.introVideo education.certifications basicDetails.fullName')
            .lean();
        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found',
            });
        }
        const gallery = {
            certificates: (teacher.education?.certifications || []).map((cert) => ({
                name: cert.name,
                issuer: cert.issuer,
                year: cert.year,
                url: cert.certificateUrl || null,
            })),
            qualificationImages: teacher.verificationDocuments?.qualificationDocuments || [],
            portfolioPhotos: teacher.verificationDocuments?.portfolioPhotos || [],
            introVideo: teacher.verificationDocuments?.introVideo || null,
            tutorName: teacher.basicDetails?.fullName || 'Tutor',
        };
        return res.status(200).json({
            success: true,
            data: gallery,
        });
    }
    catch (error) {
        console.error('Get teacher gallery error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get gallery',
            error: error.message,
        });
    }
};
exports.getTeacherGallery = getTeacherGallery;
const getTeacherStats = async (req, res) => {
    try {
        const { id } = req.params;
        const teacher = await TeacherProfile_1.TeacherProfile.findById(id)
            .select('stats pricingRevenue.experienceYears basicDetails.fullName createdAt')
            .lean();
        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found',
            });
        }
        const stats = {
            totalStudents: teacher.stats?.totalStudents || 0,
            activeStudents: teacher.stats?.activeStudents || 0,
            completedClasses: teacher.stats?.completedClasses || 0,
            averageRating: teacher.stats?.averageRating || 0,
            totalReviews: teacher.stats?.totalReviews || 0,
            responseRate: teacher.stats?.responseRate || 0,
            responseTime: teacher.stats?.responseTime || 'N/A',
            experienceYears: teacher.pricingRevenue?.experienceYears || 0,
            memberSince: teacher.createdAt,
            tutorName: teacher.basicDetails?.fullName || 'Tutor',
        };
        return res.status(200).json({
            success: true,
            data: stats,
        });
    }
    catch (error) {
        console.error('Get teacher stats error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get stats',
            error: error.message,
        });
    }
};
exports.getTeacherStats = getTeacherStats;
const toggleVacationMode = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const teacherProfile = await TeacherProfile_1.TeacherProfile.findOne({ userId });
        if (!teacherProfile) {
            return res.status(404).json({
                success: false,
                message: 'Teacher profile not found',
            });
        }
        await teacherProfile.toggleVacationMode();
        return res.status(200).json({
            success: true,
            message: `Vacation mode ${teacherProfile.locationAvailability.vacationMode ? 'enabled' : 'disabled'}`,
            data: {
                vacationMode: teacherProfile.locationAvailability.vacationMode,
            },
        });
    }
    catch (error) {
        console.error('Toggle vacation mode error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to toggle vacation mode',
            error: error.message,
        });
    }
};
exports.toggleVacationMode = toggleVacationMode;
const getProfileCompletion = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const profile = await TeacherProfile_1.TeacherProfile.findOne({ userId }).lean();
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        }
        const sections = {
            basicDetails: !!(profile.basicDetails?.fullName &&
                profile.basicDetails?.gender &&
                profile.basicDetails?.mobileNumber &&
                profile.basicDetails?.email &&
                profile.basicDetails?.languages?.length > 0),
            profilePhoto: !!(profile.basicDetails?.profilePhoto),
            education: !!(profile.education?.highestQualification &&
                profile.education?.degree &&
                profile.education?.university),
            subjects: !!(profile.teachingDetails?.subjects?.length > 0),
            classes: !!(profile.teachingDetails?.classes?.length > 0),
            boards: !!(profile.teachingDetails?.boards?.length > 0),
            teachingModes: !!(profile.teachingDetails?.teachingModes?.length > 0),
            location: !!(profile.locationAvailability?.city &&
                profile.locationAvailability?.pincode),
            availability: !!(profile.locationAvailability?.availableDays?.length > 0 &&
                profile.locationAvailability?.customTimeSlots?.length > 0),
            discoverability: !!(profile.discoverability?.availableForNewStudents !== undefined &&
                profile.discoverability?.visibleInMarketplace !== undefined &&
                profile.discoverability?.locationCoverage?.city &&
                profile.discoverability?.locationCoverage?.state),
            pricing: !!(profile.pricingRevenue?.hourlyRate > 0 &&
                profile.pricingRevenue?.monthlyRate > 0),
            documents: !!(profile.verificationDocuments?.aadhaarCard),
        };
        const completedCount = Object.values(sections).filter(Boolean).length;
        const totalCount = Object.keys(sections).length;
        const percentage = Math.round((completedCount / totalCount) * 100);
        const canApply = percentage >= 70;
        return res.status(200).json({
            success: true,
            data: {
                percentage,
                completedCount,
                totalCount,
                sections,
                canApply,
                verificationStatus: profile.verificationStatus,
                isVerified: profile.isVerified,
            },
        });
    }
    catch (error) {
        console.error('Get profile completion error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get profile completion',
            error: error.message,
        });
    }
};
exports.getProfileCompletion = getProfileCompletion;
const STANDARD_SUBJECTS = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Hindi',
    'Science', 'Social Studies', 'Computer Science', 'Accounts', 'Economics',
    'Business Studies', 'History', 'Geography', 'Civics', 'French', 'German',
    'Sanskrit', 'Physical Education', 'Arts', 'Environmental Studies',
    'IELTS', 'Spoken English', 'Coding', 'Robotics',
];
const STANDARD_CLASSES = [
    { group: 'Class 1–5', values: ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'] },
    { group: 'Class 6–8', values: ['Class 6', 'Class 7', 'Class 8'] },
    { group: 'Class 9–10', values: ['Class 9', 'Class 10'] },
    { group: 'Class 11–12', values: ['Class 11', 'Class 12'] },
    { group: 'College', values: ['College Level', 'Undergraduate', 'Postgraduate'] },
    { group: 'Competitive Exams', values: ['JEE', 'NEET', 'CUET', 'UPSC', 'SSC', 'Banking', 'State Exams'] },
];
const STANDARD_BOARDS = ['CBSE', 'ICSE', 'State Board', 'IB', 'IGCSE', 'NIOS'];
const TEACHING_MODES = ['online', 'student_home', 'own_home', 'group'];
const STUDENT_TYPES = ['school_students', 'college_students', 'competitive_exams', 'working_professionals'];
const TEACHING_LEVELS = ['beginner', 'intermediate', 'advanced'];
const EXAM_PREPARATION = ['JEE', 'NEET', 'CUET', 'UPSC', 'SSC', 'Banking', 'State Exams'];
const getSubjects = async (req, res) => {
    return res.status(200).json({
        success: true,
        data: {
            subjects: STANDARD_SUBJECTS,
            boards: STANDARD_BOARDS,
            teachingModes: TEACHING_MODES,
            studentTypes: STUDENT_TYPES,
            teachingLevels: TEACHING_LEVELS,
            examPreparation: EXAM_PREPARATION,
        },
    });
};
exports.getSubjects = getSubjects;
const getClasses = async (req, res) => {
    return res.status(200).json({
        success: true,
        data: {
            classGroups: STANDARD_CLASSES,
            allClasses: STANDARD_CLASSES.flatMap(g => g.values),
        },
    });
};
exports.getClasses = getClasses;
const getPreferences = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const profile = await TeacherProfile_1.TeacherProfile.findOne({ userId })
            .select('teachingDetails pricingRevenue.experienceYears')
            .lean();
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        }
        return res.status(200).json({
            success: true,
            data: {
                subjects: profile.teachingDetails?.subjects || [],
                classes: profile.teachingDetails?.classes || [],
                boards: profile.teachingDetails?.boards || [],
                teachingModes: profile.teachingDetails?.teachingModes || [],
                subjectExperience: profile.teachingDetails?.subjectExperience || [],
                studentTypes: profile.teachingDetails?.studentTypes || [],
                teachingLevel: profile.teachingDetails?.teachingLevel || [],
                examPreparation: profile.teachingDetails?.examPreparation || [],
                specialization: profile.teachingDetails?.specialization || '',
                groupTuitionOption: profile.teachingDetails?.groupTuitionOption || false,
                groupSize: profile.teachingDetails?.groupSize || 5,
                groupRate: profile.teachingDetails?.groupRate || 0,
                experienceYears: profile.pricingRevenue?.experienceYears || 0,
            },
        });
    }
    catch (error) {
        console.error('Get preferences error:', error);
        return res.status(500).json({ success: false, message: 'Failed to get preferences', error: error.message });
    }
};
exports.getPreferences = getPreferences;
const updatePreferences = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const { subjects, classes, boards, teachingModes, subjectExperience, studentTypes, teachingLevel, examPreparation, specialization, groupTuitionOption, groupSize, groupRate, } = req.body;
        if (subjects && subjects.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one subject is required' });
        }
        if (classes && classes.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one class is required' });
        }
        if (teachingModes && teachingModes.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one teaching mode is required' });
        }
        const updateData = {};
        if (subjects !== undefined)
            updateData['teachingDetails.subjects'] = subjects;
        if (classes !== undefined)
            updateData['teachingDetails.classes'] = classes;
        if (boards !== undefined)
            updateData['teachingDetails.boards'] = boards;
        if (teachingModes !== undefined)
            updateData['teachingDetails.teachingModes'] = teachingModes;
        if (subjectExperience !== undefined)
            updateData['teachingDetails.subjectExperience'] = subjectExperience;
        if (studentTypes !== undefined)
            updateData['teachingDetails.studentTypes'] = studentTypes;
        if (teachingLevel !== undefined)
            updateData['teachingDetails.teachingLevel'] = teachingLevel;
        if (examPreparation !== undefined)
            updateData['teachingDetails.examPreparation'] = examPreparation;
        if (specialization !== undefined)
            updateData['teachingDetails.specialization'] = specialization;
        if (groupTuitionOption !== undefined)
            updateData['teachingDetails.groupTuitionOption'] = groupTuitionOption;
        if (groupSize !== undefined)
            updateData['teachingDetails.groupSize'] = groupSize;
        if (groupRate !== undefined)
            updateData['teachingDetails.groupRate'] = groupRate;
        const updatedProfile = await TeacherProfile_1.TeacherProfile.findOneAndUpdate({ userId }, { $set: updateData }, { new: true, runValidators: true }).select('teachingDetails pricingRevenue.experienceYears');
        if (!updatedProfile) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        }
        return res.status(200).json({
            success: true,
            message: 'Teaching preferences updated successfully',
            data: {
                subjects: updatedProfile.teachingDetails?.subjects || [],
                classes: updatedProfile.teachingDetails?.classes || [],
                boards: updatedProfile.teachingDetails?.boards || [],
                teachingModes: updatedProfile.teachingDetails?.teachingModes || [],
                subjectExperience: updatedProfile.teachingDetails?.subjectExperience || [],
                studentTypes: updatedProfile.teachingDetails?.studentTypes || [],
                teachingLevel: updatedProfile.teachingDetails?.teachingLevel || [],
                examPreparation: updatedProfile.teachingDetails?.examPreparation || [],
                specialization: updatedProfile.teachingDetails?.specialization || '',
                groupTuitionOption: updatedProfile.teachingDetails?.groupTuitionOption || false,
                groupSize: updatedProfile.teachingDetails?.groupSize || 5,
                groupRate: updatedProfile.teachingDetails?.groupRate || 0,
            },
        });
    }
    catch (error) {
        console.error('Update preferences error:', error);
        return res.status(500).json({ success: false, message: 'Failed to update preferences', error: error.message });
    }
};
exports.updatePreferences = updatePreferences;
const uploadDocuments = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const files = req.files;
        const uploadedUrls = {};
        if (!files || Object.keys(files).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files uploaded',
            });
        }
        const teacherProfile = await TeacherProfile_1.TeacherProfile.findOne({ userId });
        if (!teacherProfile) {
            return res.status(404).json({
                success: false,
                message: 'Teacher profile not found',
            });
        }
        for (const [fieldName, fileArray] of Object.entries(files)) {
            uploadedUrls[fieldName] = [];
            for (const file of fileArray) {
                const result = await cloudinary_1.v2.uploader.upload(file.path, {
                    folder: `teachers/${fieldName}`,
                    public_id: `${fieldName}_${req.user?.firebaseUid}_${Date.now()}`,
                });
                uploadedUrls[fieldName].push(result.secure_url);
            }
        }
        if (uploadedUrls.certificates?.length > 0) {
            teacherProfile.verificationDocuments.qualificationDocuments.push(...uploadedUrls.certificates);
        }
        if (uploadedUrls.portfolio?.length > 0) {
            teacherProfile.verificationDocuments.portfolioPhotos.push(...uploadedUrls.portfolio);
        }
        await teacherProfile.save();
        return res.status(200).json({
            success: true,
            message: 'Documents uploaded successfully',
            data: uploadedUrls,
        });
    }
    catch (error) {
        console.error('Upload documents error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to upload documents',
            error: error.message,
        });
    }
};
exports.uploadDocuments = uploadDocuments;
const getAvailability = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const profile = await TeacherProfile_1.TeacherProfile.findOne({ userId })
            .select('locationAvailability');
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        }
        return res.status(200).json({
            success: true,
            data: profile.locationAvailability,
        });
    }
    catch (error) {
        console.error('Get availability error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get availability',
            error: error.message,
        });
    }
};
exports.getAvailability = getAvailability;
const updateAvailability = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const { availableDays, availableTimeSlots, customTimeSlots, weeklySchedule, maxStudents, vacationMode, } = req.body;
        if (!availableDays || availableDays.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one active day is required' });
        }
        if (!customTimeSlots || customTimeSlots.length === 0) {
            return res.status(400).json({ success: false, message: 'At least one time slot is required' });
        }
        const updateData = {};
        if (availableDays !== undefined)
            updateData['locationAvailability.availableDays'] = availableDays;
        if (availableTimeSlots !== undefined)
            updateData['locationAvailability.availableTimeSlots'] = availableTimeSlots;
        if (customTimeSlots !== undefined)
            updateData['locationAvailability.customTimeSlots'] = customTimeSlots;
        if (weeklySchedule !== undefined)
            updateData['locationAvailability.weeklySchedule'] = weeklySchedule;
        if (maxStudents !== undefined)
            updateData['locationAvailability.maxStudents'] = maxStudents;
        if (vacationMode !== undefined)
            updateData['locationAvailability.vacationMode'] = vacationMode;
        const updatedProfile = await TeacherProfile_1.TeacherProfile.findOneAndUpdate({ userId }, { $set: updateData }, { new: true, runValidators: true }).select('locationAvailability');
        if (!updatedProfile) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        }
        return res.status(200).json({
            success: true,
            message: 'Availability updated successfully',
            data: updatedProfile.locationAvailability,
        });
    }
    catch (error) {
        console.error('Update availability error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update availability',
            error: error.message,
        });
    }
};
exports.updateAvailability = updateAvailability;
const getDiscoverability = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const profile = await TeacherProfile_1.TeacherProfile.findOne({ userId })
            .select('discoverability');
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        }
        return res.status(200).json({
            success: true,
            data: profile.discoverability,
        });
    }
    catch (error) {
        console.error('Get discoverability error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get discoverability',
            error: error.message,
        });
    }
};
exports.getDiscoverability = getDiscoverability;
const updateDiscoverability = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const { availableForNewStudents, visibleInMarketplace, onlineStatus, travelSettings, locationCoverage, } = req.body;
        const updateData = {};
        if (availableForNewStudents !== undefined)
            updateData['discoverability.availableForNewStudents'] = availableForNewStudents;
        if (visibleInMarketplace !== undefined)
            updateData['discoverability.visibleInMarketplace'] = visibleInMarketplace;
        if (onlineStatus !== undefined)
            updateData['discoverability.onlineStatus'] = onlineStatus;
        if (travelSettings !== undefined)
            updateData['discoverability.travelSettings'] = travelSettings;
        if (locationCoverage !== undefined)
            updateData['discoverability.locationCoverage'] = locationCoverage;
        const updatedProfile = await TeacherProfile_1.TeacherProfile.findOneAndUpdate({ userId }, { $set: updateData }, { new: true, runValidators: true }).select('discoverability');
        if (!updatedProfile) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        }
        return res.status(200).json({
            success: true,
            message: 'Discoverability updated successfully',
            data: updatedProfile.discoverability,
        });
    }
    catch (error) {
        console.error('Update discoverability error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update discoverability',
            error: error.message,
        });
    }
};
exports.updateDiscoverability = updateDiscoverability;
const getMatchingEligibility = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const profile = await TeacherProfile_1.TeacherProfile.findOne({ userId })
            .select('profileCompletionPercentage verificationStatus discoverability locationAvailability');
        if (!profile) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        }
        const isEligible = (profile.profileCompletionPercentage || 0) >= 70 &&
            profile.verificationStatus !== 'rejected' &&
            profile.discoverability?.visibleInMarketplace === true &&
            profile.discoverability?.availableForNewStudents === true &&
            profile.locationAvailability?.availableDays?.length > 0 &&
            profile.locationAvailability?.customTimeSlots?.length > 0;
        return res.status(200).json({
            success: true,
            data: {
                isEligible,
                profileCompletionPercentage: profile.profileCompletionPercentage || 0,
                verificationStatus: profile.verificationStatus,
                visibleInMarketplace: profile.discoverability?.visibleInMarketplace || false,
                availableForNewStudents: profile.discoverability?.availableForNewStudents || false,
                hasActiveDays: (profile.locationAvailability?.availableDays?.length || 0) > 0,
                hasTimeSlots: (profile.locationAvailability?.customTimeSlots?.length || 0) > 0,
            },
        });
    }
    catch (error) {
        console.error('Get matching eligibility error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get matching eligibility',
            error: error.message,
        });
    }
};
exports.getMatchingEligibility = getMatchingEligibility;
const REQ_WEIGHTS = {
    subject: 0.30,
    classGrade: 0.18,
    board: 0.12,
    location: 0.15,
    budget: 0.10,
    mode: 0.10,
    timing: 0.05,
};
const MODE_MAP_LOCAL = {
    home: ['student_home', 'own_home'],
    online: ['online'],
    group: ['group'],
    crash: ['online', 'student_home', 'own_home', 'group'],
};
function calcOnTheFlyScore(req, teacher) {
    const reqSubjects = req.subjects || [];
    const tSubjects = teacher.teachingDetails?.subjects || [];
    const matchedSubs = reqSubjects.filter(s => tSubjects.some(ts => ts.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(ts.toLowerCase())));
    const subjectScore = reqSubjects.length > 0
        ? (() => {
            const pct = (matchedSubs.length / reqSubjects.length) * 100;
            if (pct >= 80)
                return 100;
            if (pct >= 60)
                return 80;
            if (pct >= 40)
                return 60;
            if (pct >= 20)
                return 40;
            return pct > 0 ? 20 : 0;
        })()
        : 0;
    const gradeNum = (req.studentDetails?.grade || '').replace(/\D/g, '');
    const tClasses = teacher.teachingDetails?.classes || [];
    const classMatch = tClasses.some(c => {
        const cn = c.replace(/\D/g, '');
        return gradeNum && cn ? gradeNum === cn : c.toLowerCase().trim() === (req.studentDetails?.grade || '').toLowerCase().trim();
    });
    const classScore = classMatch ? 100 : 0;
    const reqBoard = (req.studentDetails?.board || '').toLowerCase();
    const tBoards = teacher.teachingDetails?.boards || [];
    const boardMatch = tBoards.some(b => b.toLowerCase().includes(reqBoard) || reqBoard.includes(b.toLowerCase()));
    const boardScore = (reqBoard && boardMatch) ? 100 : 0;
    const reqCity = (req.location?.city || '').toLowerCase();
    const tCity = (teacher.locationAvailability?.city || '').toLowerCase();
    const locationScore = reqCity && tCity && reqCity === tCity ? 80 : 20;
    const minB = req.budget?.minAmount || 0;
    const maxB = req.budget?.maxAmount || 0;
    const rate = teacher.pricingRevenue?.hourlyRate || 0;
    let budgetScore = 50;
    if (maxB > 0) {
        budgetScore = (rate >= minB && rate <= maxB) ? 100 : (rate < maxB * 1.2 ? 60 : 30);
    }
    const acceptModes = MODE_MAP_LOCAL[req.tuitionType] || [];
    const tModes = teacher.teachingDetails?.teachingModes || [];
    const modeMatch = tModes.some(m => acceptModes.includes(m.toLowerCase()));
    const modeScore = modeMatch ? 100 : 0;
    const reqTimings = req.schedule?.preferredTimings || [];
    const tSlots = teacher.locationAvailability?.availableTimeSlots || [];
    const overlap = reqTimings.filter(t => tSlots.some(ts => ts.toLowerCase().includes(t.toLowerCase())));
    const timingScore = reqTimings.length > 0 ? (overlap.length / reqTimings.length) * 100 : 50;
    const core = subjectScore * REQ_WEIGHTS.subject +
        classScore * REQ_WEIGHTS.classGrade +
        boardScore * REQ_WEIGHTS.board +
        locationScore * REQ_WEIGHTS.location +
        budgetScore * REQ_WEIGHTS.budget +
        modeScore * REQ_WEIGHTS.mode +
        timingScore * REQ_WEIGHTS.timing;
    return Math.min(100, Math.round(core));
}
const getAvailableRequirements = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const teacher = await TeacherProfile_1.TeacherProfile.findOne({ userId }).lean();
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        }
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 15));
        const skip = (page - 1) * limit;
        const { search, subject, board, grade, city, area, minBudget, maxBudget, mode, minMatch, sortBy, postedDays, } = req.query;
        const query = {
            status: 'active',
            isActive: true,
            expiresAt: { $gt: new Date() },
        };
        if (search?.trim()) {
            const rx = new RegExp(search.trim(), 'i');
            query.$or = [
                { requirementId: rx },
                { subjects: rx },
                { 'location.city': rx },
                { 'location.address': rx },
            ];
        }
        if (subject?.trim()) {
            query.subjects = { $regex: new RegExp(subject.trim(), 'i') };
        }
        if (board?.trim()) {
            query['studentDetails.board'] = { $regex: new RegExp(board.trim(), 'i') };
        }
        if (grade?.trim()) {
            query['studentDetails.grade'] = { $regex: new RegExp(grade.trim(), 'i') };
        }
        if (city?.trim()) {
            query['location.city'] = { $regex: new RegExp(city.trim(), 'i') };
        }
        if (area?.trim()) {
            query['location.address'] = { $regex: new RegExp(area.trim(), 'i') };
        }
        if (minBudget)
            query['budget.maxAmount'] = { $gte: parseInt(minBudget) };
        if (maxBudget) {
            query['budget.minAmount'] = { ...(query['budget.minAmount'] || {}), $lte: parseInt(maxBudget) };
        }
        if (mode?.trim()) {
            query.tuitionType = { $regex: new RegExp(mode.trim(), 'i') };
        }
        if (postedDays) {
            const since = new Date();
            since.setDate(since.getDate() - parseInt(postedDays));
            query.createdAt = { $gte: since };
        }
        const [total, rawReqs] = await Promise.all([
            ParentRequirement_1.ParentRequirement.countDocuments(query),
            ParentRequirement_1.ParentRequirement.find(query)
                .select('requirementId studentDetails subjects tuitionType location schedule budget status priority totalMatches views createdAt expiresAt')
                .sort({ createdAt: -1 })
                .lean(),
        ]);
        let scored = rawReqs.map((r) => ({
            ...r,
            matchScore: calcOnTheFlyScore(r, teacher),
            applicationsCount: r.totalMatches || 0,
        }));
        if (minMatch) {
            const threshold = parseInt(minMatch);
            scored = scored.filter(r => r.matchScore >= threshold);
        }
        if (sortBy === 'match') {
            scored.sort((a, b) => b.matchScore - a.matchScore);
        }
        else if (sortBy === 'budget') {
            scored.sort((a, b) => (b.budget?.maxAmount || 0) - (a.budget?.maxAmount || 0));
        }
        else {
        }
        const paginated = scored.slice(skip, skip + limit);
        const finalTotal = scored.length;
        const totalPages = Math.ceil(finalTotal / limit);
        return res.status(200).json({
            success: true,
            data: {
                requirements: paginated,
                pagination: { page, limit, total: finalTotal, totalPages },
            },
        });
    }
    catch (error) {
        console.error('Get available requirements error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch requirements',
            error: error.message,
        });
    }
};
exports.getAvailableRequirements = getAvailableRequirements;
const getRequirementMatchAnalysis = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId)
            return res.status(401).json({ success: false, message: 'Authentication required' });
        const teacher = await TeacherProfile_1.TeacherProfile.findOne({ userId }).lean();
        if (!teacher)
            return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        const id = req.params.id;
        const requirement = await ParentRequirement_1.ParentRequirement.findOne({
            $or: [{ requirementId: id }, { _id: id.match(/^[a-f\d]{24}$/i) ? id : undefined }],
            status: 'active',
            isActive: true,
        }).lean();
        if (!requirement)
            return res.status(404).json({ success: false, message: 'Requirement not found' });
        const t = teacher;
        const r = requirement;
        const reqSubjects = r.subjects || [];
        const tSubjects = t.teachingDetails?.subjects || [];
        const matchedSubs = reqSubjects.filter(s => tSubjects.some((ts) => ts.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(ts.toLowerCase())));
        const subjectPct = reqSubjects.length > 0 ? Math.round((matchedSubs.length / reqSubjects.length) * 100) : 0;
        let subjectScore = 0;
        if (subjectPct >= 80)
            subjectScore = 100;
        else if (subjectPct >= 60)
            subjectScore = 80;
        else if (subjectPct >= 40)
            subjectScore = 60;
        else if (subjectPct >= 20)
            subjectScore = 40;
        else if (subjectPct > 0)
            subjectScore = 20;
        const gradeNum = (r.studentDetails?.grade || '').replace(/\D/g, '');
        const tClasses = t.teachingDetails?.classes || [];
        const classMatch = tClasses.some((c) => {
            const cn = c.replace(/\D/g, '');
            return gradeNum && cn ? gradeNum === cn : c.toLowerCase().trim() === (r.studentDetails?.grade || '').toLowerCase().trim();
        });
        const classScore = classMatch ? 100 : 0;
        const reqBoard = (r.studentDetails?.board || '').toLowerCase();
        const tBoards = t.teachingDetails?.boards || [];
        const boardMatch = reqBoard ? tBoards.some((b) => b.toLowerCase().includes(reqBoard) || reqBoard.includes(b.toLowerCase())) : false;
        const boardScore = boardMatch ? 100 : 0;
        const reqCity = (r.location?.city || '').toLowerCase();
        const tCity = (t.locationAvailability?.city || '').toLowerCase();
        const locationScore = reqCity && tCity && reqCity === tCity ? 80 : 20;
        const minB = r.budget?.minAmount || 0;
        const maxB = r.budget?.maxAmount || 0;
        const rate = t.pricingRevenue?.hourlyRate || 0;
        let budgetScore = 50;
        if (maxB > 0)
            budgetScore = (rate >= minB && rate <= maxB) ? 100 : (rate < maxB * 1.2 ? 60 : 30);
        const acceptModes = MODE_MAP_LOCAL[r.tuitionType] || [];
        const tModes = t.teachingDetails?.teachingModes || [];
        const modeMatch = tModes.some((m) => acceptModes.includes(m.toLowerCase()));
        const modeScore = modeMatch ? 100 : 0;
        const reqTimings = r.schedule?.preferredTimings || [];
        const tSlots = t.locationAvailability?.availableTimeSlots || [];
        const overlap = reqTimings.filter((ts) => tSlots.some(s => s.toLowerCase().includes(ts.toLowerCase())));
        const timingScore = reqTimings.length > 0 ? Math.round((overlap.length / reqTimings.length) * 100) : 50;
        const overallScore = Math.min(100, Math.round(subjectScore * REQ_WEIGHTS.subject +
            classScore * REQ_WEIGHTS.classGrade +
            boardScore * REQ_WEIGHTS.board +
            locationScore * REQ_WEIGHTS.location +
            budgetScore * REQ_WEIGHTS.budget +
            modeScore * REQ_WEIGHTS.mode +
            timingScore * REQ_WEIGHTS.timing));
        const tutorMatches = await TutorMatch_1.TutorMatch.find({ requirementId: requirement._id }).lean();
        const total = tutorMatches.length;
        const shortlisted = tutorMatches.filter((m) => m.status === 'shortlisted').length;
        const rejected = tutorMatches.filter((m) => m.status === 'rejected').length;
        const selected = tutorMatches.filter((m) => m.status === 'hired').length;
        const myMatch = tutorMatches.find((m) => m.teacherId?.toString() === userId.toString());
        let myPosition = null;
        if (myMatch) {
            const sorted = [...tutorMatches].sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0));
            myPosition = sorted.findIndex((m) => m.teacherId?.toString() === userId.toString()) + 1;
        }
        return res.status(200).json({
            success: true,
            data: {
                overall: overallScore,
                breakdown: {
                    subject: { score: Math.round(subjectScore * REQ_WEIGHTS.subject * 100) / 100, rawScore: subjectScore, matchedSubjects: matchedSubs, requirementSubjects: reqSubjects },
                    class: { score: Math.round(classScore * REQ_WEIGHTS.classGrade * 100) / 100, rawScore: classScore, isMatch: classMatch, requirementGrade: r.studentDetails?.grade || '' },
                    board: { score: Math.round(boardScore * REQ_WEIGHTS.board * 100) / 100, rawScore: boardScore, isMatch: boardMatch, requirementBoard: r.studentDetails?.board || '' },
                    location: { score: Math.round(locationScore * REQ_WEIGHTS.location * 100) / 100, rawScore: locationScore, requirementCity: r.location?.city || '', teacherCity: t.locationAvailability?.city || '' },
                    budget: { score: Math.round(budgetScore * REQ_WEIGHTS.budget * 100) / 100, rawScore: budgetScore, requirementMin: minB, requirementMax: maxB, teacherRate: rate },
                    mode: { score: Math.round(modeScore * REQ_WEIGHTS.mode * 100) / 100, rawScore: modeScore, isMatch: modeMatch, requirementMode: r.tuitionType, teacherModes: tModes },
                    availability: { score: Math.round(timingScore * REQ_WEIGHTS.timing * 100) / 100, rawScore: timingScore, overlap, requirementTimings: reqTimings },
                },
                competition: { total, shortlisted, rejected, selected, myPosition },
            },
        });
    }
    catch (error) {
        console.error('Get match analysis error:', error);
        return res.status(500).json({ success: false, message: 'Failed to get match analysis', error: error.message });
    }
};
exports.getRequirementMatchAnalysis = getRequirementMatchAnalysis;
const saveRequirement = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId)
            return res.status(401).json({ success: false, message: 'Authentication required' });
        const id = req.params.id;
        const requirement = await ParentRequirement_1.ParentRequirement.findOne({
            $or: [{ requirementId: id }, { _id: id.match(/^[a-f\d]{24}$/i) ? id : undefined }],
        }).select('_id').lean();
        if (!requirement)
            return res.status(404).json({ success: false, message: 'Requirement not found' });
        await TeacherProfile_1.TeacherProfile.findOneAndUpdate({ userId }, { $addToSet: { savedRequirements: requirement._id } });
        return res.status(200).json({ success: true, message: 'Requirement saved' });
    }
    catch (error) {
        console.error('Save requirement error:', error);
        return res.status(500).json({ success: false, message: 'Failed to save requirement', error: error.message });
    }
};
exports.saveRequirement = saveRequirement;
const unsaveRequirement = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId)
            return res.status(401).json({ success: false, message: 'Authentication required' });
        const id = req.params.id;
        const requirement = await ParentRequirement_1.ParentRequirement.findOne({
            $or: [{ requirementId: id }, { _id: id.match(/^[a-f\d]{24}$/i) ? id : undefined }],
        }).select('_id').lean();
        if (!requirement)
            return res.status(404).json({ success: false, message: 'Requirement not found' });
        await TeacherProfile_1.TeacherProfile.findOneAndUpdate({ userId }, { $pull: { savedRequirements: requirement._id } });
        return res.status(200).json({ success: true, message: 'Requirement unsaved' });
    }
    catch (error) {
        console.error('Unsave requirement error:', error);
        return res.status(500).json({ success: false, message: 'Failed to unsave requirement', error: error.message });
    }
};
exports.unsaveRequirement = unsaveRequirement;
const hideRequirement = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId)
            return res.status(401).json({ success: false, message: 'Authentication required' });
        const id = req.params.id;
        const requirement = await ParentRequirement_1.ParentRequirement.findOne({
            $or: [{ requirementId: id }, { _id: id.match(/^[a-f\d]{24}$/i) ? id : undefined }],
        }).select('_id').lean();
        if (!requirement)
            return res.status(404).json({ success: false, message: 'Requirement not found' });
        await TeacherProfile_1.TeacherProfile.findOneAndUpdate({ userId }, {
            $addToSet: { hiddenRequirements: requirement._id },
            $pull: { savedRequirements: requirement._id },
        });
        return res.status(200).json({ success: true, message: 'Requirement hidden' });
    }
    catch (error) {
        console.error('Hide requirement error:', error);
        return res.status(500).json({ success: false, message: 'Failed to hide requirement', error: error.message });
    }
};
exports.hideRequirement = hideRequirement;
const getRequirementById = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const teacher = await TeacherProfile_1.TeacherProfile.findOne({ userId }).lean();
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        }
        const id = req.params.id;
        const requirement = await ParentRequirement_1.ParentRequirement.findOne({
            $or: [{ requirementId: id }, { _id: id.match(/^[a-f\d]{24}$/i) ? id : undefined }],
            status: 'active',
            isActive: true,
        })
            .select('requirementId studentDetails subjects tuitionType location schedule budget status priority totalMatches views createdAt expiresAt tutorPreferences languagePreference')
            .lean();
        if (!requirement) {
            return res.status(404).json({ success: false, message: 'Requirement not found' });
        }
        const existingMatch = await TutorMatch_1.TutorMatch.findOne({
            teacherId: userId,
            requirementId: requirement._id,
        }).select('status').lean();
        const matchScore = calcOnTheFlyScore(requirement, teacher);
        const t = teacher;
        const reqId = requirement._id;
        const isSaved = (t.savedRequirements || []).some((id) => id.toString() === reqId.toString());
        const isHidden = (t.hiddenRequirements || []).some((id) => id.toString() === reqId.toString());
        return res.status(200).json({
            success: true,
            data: {
                ...requirement,
                matchScore,
                applicationsCount: requirement.totalMatches || 0,
                applicationStatus: existingMatch?.status || null,
                isSaved,
                isHidden,
            },
        });
    }
    catch (error) {
        console.error('Get requirement by id error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch requirement',
            error: error.message,
        });
    }
};
exports.getRequirementById = getRequirementById;
const getRecommendedRequirements = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const teacher = await TeacherProfile_1.TeacherProfile.findOne({ userId }).lean();
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher profile not found' });
        }
        const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
        const subjectFilter = teacher.teachingDetails?.subjects?.length
            ? { subjects: { $in: teacher.teachingDetails.subjects } }
            : {};
        const cityFilter = teacher.locationAvailability?.city
            ? { 'location.city': { $regex: new RegExp(teacher.locationAvailability.city, 'i') } }
            : {};
        const candidates = await ParentRequirement_1.ParentRequirement.find({
            status: 'active',
            isActive: true,
            expiresAt: { $gt: new Date() },
            ...subjectFilter,
            ...cityFilter,
        })
            .select('requirementId studentDetails subjects tuitionType location schedule budget status priority totalMatches views createdAt expiresAt')
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        const scored = candidates
            .map((r) => ({ ...r, matchScore: calcOnTheFlyScore(r, teacher), applicationsCount: r.totalMatches || 0 }))
            .filter(r => r.matchScore >= 60)
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, limit);
        return res.status(200).json({
            success: true,
            data: {
                requirements: scored,
                total: scored.length,
            },
        });
    }
    catch (error) {
        console.error('Get recommended requirements error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch recommended requirements',
            error: error.message,
        });
    }
};
exports.getRecommendedRequirements = getRecommendedRequirements;
//# sourceMappingURL=teacherController.js.map