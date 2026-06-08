"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDocuments = exports.toggleVacationMode = exports.getTeacherById = exports.getAllTeachers = exports.updateTeacherProfile = exports.getTeacherProfile = exports.registerTeacher = void 0;
const TeacherProfile_1 = require("../models/TeacherProfile");
const User_1 = require("../models/User");
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
//# sourceMappingURL=teacherController.js.map