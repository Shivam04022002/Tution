"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extendRequirement = exports.closeRequirement = exports.getRequirementById = exports.getAllRequirements = exports.updateParentProfile = exports.getParentProfile = exports.registerParent = void 0;
const ParentRequirement_1 = require("../models/ParentRequirement");
const User_1 = require("../models/User");
const MatchingService_1 = require("../services/MatchingService");
const registerParent = async (req, res) => {
    try {
        const userId = req.user?._id;
        const firebaseUid = req.user?.firebaseUid;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const existingRequirement = await ParentRequirement_1.ParentRequirement.findOne({ parentId: userId });
        if (existingRequirement) {
            return res.status(409).json({
                success: false,
                message: 'Parent profile already exists. Use update endpoint to modify your profile.',
                data: {
                    requirementId: existingRequirement.requirementId,
                    requirement: existingRequirement,
                },
            });
        }
        const { parentDetails, studentDetails, tuitionRequirement, preferredTiming, locationDetails, budgetDetails, tutorPreferences, } = req.body;
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
        const modeMap = {
            'Home Tuition': 'home',
            'Online Tuition': 'online',
            'Group Tuition': 'group',
        };
        const tuitionType = modeMap[tuitionRequirement?.tuitionMode] || 'home';
        const requirementId = generateRequirementId();
        const parentRequirement = new ParentRequirement_1.ParentRequirement({
            parentId: userId,
            requirementId,
            studentDetails: {
                studentName: studentDetails?.studentName,
                age: parseInt(studentDetails?.age, 10) || 0,
                grade: studentDetails?.className,
                board: tuitionRequirement?.board,
                schoolName: studentDetails?.schoolName,
                genderPreference: studentDetails?.gender || 'any',
                multipleChildren: false,
            },
            subjects: tuitionRequirement?.subjects || [],
            languagePreference: ['English'],
            tuitionType,
            location: {
                address: locationDetails?.address,
                city: locationDetails?.city,
                pincode: locationDetails?.pincode,
                coordinates: {
                    latitude: 0,
                    longitude: 0,
                },
                teachingRadius: 5,
            },
            schedule: {
                daysPerWeek: preferredTiming?.days?.length?.toString() || '3',
                preferredTimings: preferredTiming?.timeSlots || [],
                startDate: new Date().toISOString().split('T')[0],
            },
            budget: {
                minAmount,
                maxAmount,
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
            tutorPreferences: tutorPreferences || '',
        });
        if (tutorPreferences && tutorPreferences.trim()) {
            parentRequirement.tutorPreferences = tutorPreferences.trim();
        }
        await parentRequirement.save();
        MatchingService_1.MatchingService.generateAndSaveForRequirement(parentRequirement).then(count => {
            console.log(`[Matching] Auto-generated ${count} matches for new requirement ${requirementId}`);
        }).catch(err => {
            console.error(`[Matching] Auto-match failed for requirement ${requirementId}:`, err);
        });
        await User_1.User.findByIdAndUpdate(userId, {
            role: 'parent',
            profile: {
                ...(req.user?.profile || {}),
                parentName: parentDetails?.parentName,
                mobileNumber: parentDetails?.mobileNumber,
                email: parentDetails?.email,
            },
            isProfileComplete: true,
        });
        return res.status(201).json({
            success: true,
            message: 'Parent registration successful. Your requirement has been posted.',
            data: {
                requirementId,
                requirement: parentRequirement,
            },
        });
    }
    catch (error) {
        console.error('Parent registration error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to register parent',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.registerParent = registerParent;
const getParentProfile = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const user = await User_1.User.findById(userId).select('-password -firebaseUid');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }
        const requirements = await ParentRequirement_1.ParentRequirement.find({ parentId: userId })
            .sort({ createdAt: -1 })
            .populate('matchedTutors.tutorId', 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects');
        return res.status(200).json({
            success: true,
            data: {
                user,
                requirements,
                totalRequirements: requirements.length,
                activeRequirements: requirements.filter(r => r.status === 'active').length,
            },
        });
    }
    catch (error) {
        console.error('Get parent profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch parent profile',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getParentProfile = getParentProfile;
const updateParentProfile = async (req, res) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const allowedUpdates = [
            'profile.parentName',
            'profile.mobileNumber',
            'profile.email',
            'profile.address',
        ];
        const updates = req.body;
        const updateData = {};
        Object.keys(updates).forEach((key) => {
            if (allowedUpdates.includes(key) || allowedUpdates.some((allowed) => key.startsWith(allowed + '.'))) {
                updateData[key] = updates[key];
            }
        });
        const user = await User_1.User.findByIdAndUpdate(userId, { $set: updateData }, { new: true, runValidators: true }).select('-password -firebaseUid');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: { user },
        });
    }
    catch (error) {
        console.error('Update parent profile error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.updateParentProfile = updateParentProfile;
const getAllRequirements = async (req, res) => {
    try {
        const { city, subjects, minBudget, maxBudget, status = 'active', page = 1, limit = 20, } = req.query;
        const filter = {};
        if (status) {
            filter.status = status;
        }
        if (city) {
            filter['location.city'] = { $regex: city, $options: 'i' };
        }
        if (subjects) {
            const subjectArray = Array.isArray(subjects) ? subjects : [subjects];
            filter.subjects = { $in: subjectArray };
        }
        if (minBudget || maxBudget) {
            filter['budget.maxAmount'] = {};
            if (minBudget) {
                filter['budget.maxAmount'].$gte = parseInt(minBudget, 10);
            }
            if (maxBudget) {
                filter['budget.maxAmount'].$lte = parseInt(maxBudget, 10);
            }
        }
        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const publicSafeProjection = {
            'location.address': 0,
            'location.pincode': 0,
            'location.coordinates': 0,
            'matchedTutors': 0,
            'unlocks': 0,
        };
        const requirements = await ParentRequirement_1.ParentRequirement.find(filter, publicSafeProjection)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit, 10))
            .populate('parentId', 'profile.parentName')
            .select('-matchedTutors -unlocks');
        const total = await ParentRequirement_1.ParentRequirement.countDocuments(filter);
        return res.status(200).json({
            success: true,
            data: {
                requirements,
                pagination: {
                    page: parseInt(page, 10),
                    limit: parseInt(limit, 10),
                    total,
                    pages: Math.ceil(total / parseInt(limit, 10)),
                },
            },
        });
    }
    catch (error) {
        console.error('Get all requirements error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch requirements',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getAllRequirements = getAllRequirements;
const getRequirementById = async (req, res) => {
    try {
        const { id } = req.params;
        const publicSafeProjection = {
            'location.address': 0,
            'location.pincode': 0,
            'location.coordinates': 0,
            'matchedTutors': 0,
            'unlocks': 0,
        };
        const requirement = await ParentRequirement_1.ParentRequirement.findById(id, publicSafeProjection)
            .populate('parentId', 'profile.parentName')
            .populate('matchedTutors.tutorId', 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects stats.averageRating');
        if (!requirement) {
            return res.status(404).json({
                success: false,
                message: 'Requirement not found',
            });
        }
        return res.status(200).json({
            success: true,
            data: { requirement },
        });
    }
    catch (error) {
        console.error('Get requirement by ID error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch requirement',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getRequirementById = getRequirementById;
const closeRequirement = async (req, res) => {
    try {
        const userId = req.user?._id;
        const { id } = req.params;
        const { reason } = req.body;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const requirement = await ParentRequirement_1.ParentRequirement.findOne({
            _id: id,
            parentId: userId,
        });
        if (!requirement) {
            return res.status(404).json({
                success: false,
                message: 'Requirement not found or unauthorized',
            });
        }
        await requirement.closeRequirement(reason);
        return res.status(200).json({
            success: true,
            message: 'Requirement closed successfully',
            data: { requirement },
        });
    }
    catch (error) {
        console.error('Close requirement error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to close requirement',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.closeRequirement = closeRequirement;
const extendRequirement = async (req, res) => {
    try {
        const userId = req.user?._id;
        const { id } = req.params;
        const { days } = req.body;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const requirement = await ParentRequirement_1.ParentRequirement.findOne({
            _id: id,
            parentId: userId,
        });
        if (!requirement) {
            return res.status(404).json({
                success: false,
                message: 'Requirement not found or unauthorized',
            });
        }
        await requirement.extendExpiry(days || 7);
        return res.status(200).json({
            success: true,
            message: 'Requirement extended successfully',
            data: { requirement },
        });
    }
    catch (error) {
        console.error('Extend requirement error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to extend requirement',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.extendRequirement = extendRequirement;
const generateRequirementId = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `REQ-${timestamp}-${random}`.toUpperCase();
};
//# sourceMappingURL=parentController.js.map