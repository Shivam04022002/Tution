"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParentQuickStats = exports.getTeacherDashboard = exports.getParentDashboard = void 0;
const ParentRequirement_1 = require("../models/ParentRequirement");
const TutorApplication_1 = require("../models/TutorApplication");
const TeacherProfile_1 = require("../models/TeacherProfile");
const TutorMatch_1 = require("../models/TutorMatch");
const DemoClass_1 = require("../models/DemoClass");
const Shortlist_1 = require("../models/Shortlist");
const ScheduledClass_1 = require("../models/ScheduledClass");
const Notification_1 = require("../models/Notification");
const getParentDashboard = async (req, res) => {
    try {
        const parentId = req.user?._id;
        if (!parentId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const [activeRequirements, applications, shortlistedTutors, upcomingDemos, stats, recommendedTutors, notificationsCount,] = await Promise.all([
            ParentRequirement_1.ParentRequirement.find({
                parentId,
                status: 'active',
                isActive: true,
            }).sort({ createdAt: -1 }),
            TutorApplication_1.TutorApplication.find({
                parentId,
                isActive: true,
            })
                .populate({
                path: 'teacherProfileId',
                select: 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects pricingRevenue.hourlyRate stats.averageRating',
            })
                .populate({
                path: 'parentRequirementId',
                select: 'requirementId studentDetails subjects',
            })
                .sort({ createdAt: -1 }),
            Shortlist_1.Shortlist.find({
                parentId,
                isDeleted: false,
            })
                .populate({
                path: 'teacherProfileId',
                select: 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects pricingRevenue.hourlyRate',
            })
                .sort({ createdAt: -1 }),
            DemoClass_1.DemoClass.find({
                parentId,
                status: { $in: ['scheduled', 'rescheduled'] },
                scheduledDate: { $gte: new Date() },
                isActive: true,
            })
                .populate({
                path: 'teacherProfileId',
                select: 'basicDetails.fullName basicDetails.profilePhoto',
            })
                .sort({ scheduledDate: 1 }),
            getParentStats(parentId),
            TutorMatch_1.TutorMatch.find({
                parentId,
                status: 'recommended',
                isActive: true,
                expiryDate: { $gte: new Date() },
            })
                .populate({
                path: 'teacherId',
                select: 'profile.teacherName',
            })
                .populate({
                path: 'teacherProfileId',
                select: 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects pricingRevenue.experienceYears stats.averageRating locationAvailability.city locationAvailability.coordinates',
            })
                .sort({ overallScore: -1 })
                .limit(10),
            Notification_1.Notification.countDocuments({
                userId: parentId,
                isRead: false,
            }),
        ]);
        return res.status(200).json({
            success: true,
            data: {
                stats,
                activeRequirements,
                applications,
                shortlistedTutors,
                upcomingDemos,
                recommendedTutors,
                notificationsCount,
            },
        });
    }
    catch (error) {
        console.error('Get parent dashboard error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getParentDashboard = getParentDashboard;
const getTeacherDashboard = async (req, res) => {
    try {
        const teacherId = req.user?._id;
        if (!teacherId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const teacherProfile = await TeacherProfile_1.TeacherProfile.findOne({ userId: teacherId });
        if (!teacherProfile) {
            return res.status(404).json({
                success: false,
                message: 'Teacher profile not found',
            });
        }
        const [matches, applications, upcomingDemos, activeStudents,] = await Promise.all([
            TutorMatch_1.TutorMatch.find({
                teacherId,
                status: 'recommended',
                isActive: true,
                expiryDate: { $gte: new Date() },
            })
                .populate({
                path: 'requirementId',
                select: 'requirementId studentDetails subjects budget location schedule tuitionType',
            })
                .sort({ overallScore: -1 })
                .limit(10),
            TutorApplication_1.TutorApplication.find({
                teacherId,
                isActive: true,
            })
                .populate({
                path: 'parentRequirementId',
                select: 'requirementId studentDetails subjects budget',
            })
                .populate({
                path: 'parentId',
                select: 'profile.parentName profile.mobileNumber',
            })
                .sort({ createdAt: -1 }),
            DemoClass_1.DemoClass.find({
                teacherId,
                status: { $in: ['scheduled', 'rescheduled'] },
                scheduledDate: { $gte: new Date() },
                isActive: true,
            })
                .populate({
                path: 'parentId',
                select: 'profile.parentName profile.mobileNumber',
            })
                .sort({ scheduledDate: 1 }),
            ScheduledClass_1.ScheduledClass.find({
                teacherId,
                status: 'active',
            })
                .populate({
                path: 'parentId',
                select: 'profile.parentName',
            })
                .sort({ 'schedule.startDate': -1 }),
        ]);
        const profileCompletion = calculateTeacherProfileCompletion(teacherProfile);
        return res.status(200).json({
            success: true,
            data: {
                stats: {
                    activeStudents: teacherProfile.stats?.activeStudents || 0,
                    totalStudents: teacherProfile.stats?.totalStudents || 0,
                    totalEarnings: teacherProfile.stats?.totalEarnings || 0,
                    averageRating: teacherProfile.stats?.averageRating || 0,
                    profileCompletion,
                    verificationStatus: teacherProfile.verificationStatus || 'pending',
                    tuitionRequestsAvailable: matches.length,
                    applicationsSent: applications.length,
                },
                matches,
                applications,
                upcomingDemos,
                activeStudents,
            },
        });
    }
    catch (error) {
        console.error('Get teacher dashboard error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard data',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getTeacherDashboard = getTeacherDashboard;
async function getParentStats(parentId) {
    const [activeRequirementsCount, applicationsCount, shortlistedCount, upcomingDemosCount, closedRequirementsCount,] = await Promise.all([
        ParentRequirement_1.ParentRequirement.countDocuments({
            parentId,
            status: 'active',
            isActive: true,
        }),
        TutorApplication_1.TutorApplication.countDocuments({
            parentId,
            isActive: true,
        }),
        Shortlist_1.Shortlist.countDocuments({
            parentId,
            isDeleted: false,
        }),
        DemoClass_1.DemoClass.countDocuments({
            parentId,
            status: { $in: ['scheduled', 'rescheduled'] },
            scheduledDate: { $gte: new Date() },
            isActive: true,
        }),
        ParentRequirement_1.ParentRequirement.countDocuments({
            parentId,
            status: 'closed',
        }),
    ]);
    return {
        activeRequirements: activeRequirementsCount,
        applicationsReceived: applicationsCount,
        shortlistedTutors: shortlistedCount,
        demosScheduled: upcomingDemosCount,
        closedRequirements: closedRequirementsCount,
    };
}
const getParentQuickStats = async (req, res) => {
    try {
        const parentId = req.user?._id;
        if (!parentId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const stats = await getParentStats(parentId);
        return res.status(200).json({
            success: true,
            data: {
                activeRequirements: stats.activeRequirements,
                applications: stats.applicationsReceived,
                shortlisted: stats.shortlistedTutors,
                demoClasses: stats.demosScheduled,
            },
        });
    }
    catch (error) {
        console.error('Get parent quick stats error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch dashboard stats',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getParentQuickStats = getParentQuickStats;
function calculateTeacherProfileCompletion(profile) {
    if (!profile)
        return 0;
    const requiredFields = [
        { path: 'basicDetails.fullName', weight: 10 },
        { path: 'basicDetails.mobileNumber', weight: 10 },
        { path: 'basicDetails.email', weight: 5 },
        { path: 'basicDetails.profilePhoto', weight: 5 },
        { path: 'education.highestQualification', weight: 10 },
        { path: 'education.degree', weight: 5 },
        { path: 'teachingDetails.subjects', weight: 10, isArray: true },
        { path: 'teachingDetails.classes', weight: 10, isArray: true },
        { path: 'teachingDetails.boards', weight: 5, isArray: true },
        { path: 'locationAvailability.city', weight: 10 },
        { path: 'locationAvailability.address', weight: 5 },
        { path: 'pricingRevenue.hourlyRate', weight: 10 },
        { path: 'bio', weight: 5 },
        { path: 'verificationDocuments.aadhaarCard', weight: 10 },
        { path: 'verificationDocuments.panCard', weight: 5 },
    ];
    let filledWeight = 0;
    let totalWeight = 0;
    for (const field of requiredFields) {
        totalWeight += field.weight;
        const value = field.path.split('.').reduce((obj, key) => obj?.[key], profile);
        if (field.isArray) {
            if (value && Array.isArray(value) && value.length > 0) {
                filledWeight += field.weight;
            }
        }
        else {
            if (value && value !== '') {
                filledWeight += field.weight;
            }
        }
    }
    return Math.round((filledWeight / totalWeight) * 100);
}
//# sourceMappingURL=dashboardController.js.map