"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeacherDashboardStats = exports.getParentDashboardStats = exports.withdrawApplication = exports.acceptApplication = exports.rejectApplication = exports.shortlistApplication = exports.getTeacherApplications = exports.getParentApplications = exports.applyToRequirement = void 0;
const TutorApplication_1 = require("../models/TutorApplication");
const ParentRequirement_1 = require("../models/ParentRequirement");
const TeacherProfile_1 = require("../models/TeacherProfile");
const TutorMatch_1 = require("../models/TutorMatch");
const ScheduledClass_1 = require("../models/ScheduledClass");
const MatchingService_1 = require("../services/MatchingService");
const notificationService_1 = require("../services/notificationService");
const applyToRequirement = async (req, res) => {
    try {
        const teacherId = req.user?._id;
        const { requirementId } = req.params;
        const { message, proposedFee, proposedSchedule } = req.body;
        if (!teacherId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const requirement = await ParentRequirement_1.ParentRequirement.findById(requirementId);
        if (!requirement) {
            return res.status(404).json({
                success: false,
                message: 'Requirement not found',
            });
        }
        if (requirement.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'This requirement is no longer active',
            });
        }
        const teacherProfile = await TeacherProfile_1.TeacherProfile.findOne({ userId: teacherId });
        if (!teacherProfile) {
            return res.status(404).json({
                success: false,
                message: 'Teacher profile not found',
            });
        }
        const existingApplication = await TutorApplication_1.TutorApplication.findOne({
            parentRequirementId: requirementId,
            teacherId,
            isActive: true,
        });
        if (existingApplication) {
            return res.status(409).json({
                success: false,
                message: 'You have already applied to this requirement',
                data: { applicationId: existingApplication.applicationId },
            });
        }
        const application = new TutorApplication_1.TutorApplication({
            parentRequirementId: requirementId,
            teacherId,
            teacherProfileId: teacherProfile._id,
            parentId: requirement.parentId,
            status: 'pending',
            message,
            proposedFee,
            proposedSchedule,
            viewedByParent: false,
        });
        await application.save();
        await TutorMatch_1.TutorMatch.findOneAndUpdate({ requirementId, teacherId }, { status: 'applied', appliedAt: new Date() });
        (0, notificationService_1.notifyTeacherApplied)(requirement.parentId, teacherProfile.basicDetails.fullName, requirement.subjects?.[0] || 'your subject', application._id).catch(() => { });
        return res.status(201).json({
            success: true,
            message: 'Application submitted successfully',
            data: {
                applicationId: application.applicationId,
                application,
            },
        });
    }
    catch (error) {
        console.error('Apply to requirement error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to submit application',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.applyToRequirement = applyToRequirement;
const getParentApplications = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const { status, requirementId } = req.query;
        if (!parentId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const query = { parentId, isActive: true };
        if (status)
            query.status = status;
        if (requirementId)
            query.parentRequirementId = requirementId;
        const applications = await TutorApplication_1.TutorApplication.find(query)
            .populate({
            path: 'teacherProfileId',
            select: 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects teachingDetails.classes pricingRevenue.hourlyRate stats.averageRating education.highestQualification',
        })
            .populate({
            path: 'parentRequirementId',
            select: 'requirementId studentDetails subjects',
        })
            .sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            data: {
                applications,
                total: applications.length,
            },
        });
    }
    catch (error) {
        console.error('Get parent applications error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch applications',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getParentApplications = getParentApplications;
const getTeacherApplications = async (req, res) => {
    try {
        const teacherId = req.user?._id;
        const { status } = req.query;
        if (!teacherId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const query = { teacherId, isActive: true };
        if (status)
            query.status = status;
        const applications = await TutorApplication_1.TutorApplication.find(query)
            .populate({
            path: 'parentRequirementId',
            select: 'requirementId studentDetails grade subjects budget location schedule tuitionType status',
        })
            .populate({
            path: 'parentId',
            select: 'profile.parentName profile.mobileNumber',
        })
            .sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            data: {
                applications,
                total: applications.length,
            },
        });
    }
    catch (error) {
        console.error('Get teacher applications error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch applications',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getTeacherApplications = getTeacherApplications;
const shortlistApplication = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const { applicationId } = req.params;
        if (!parentId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const application = await TutorApplication_1.TutorApplication.findOne({
            applicationId,
            parentId,
        });
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found',
            });
        }
        application.status = 'shortlisted';
        application.shortlistedAt = new Date();
        await application.save();
        await TutorMatch_1.TutorMatch.findOneAndUpdate({ requirementId: application.parentRequirementId, teacherId: application.teacherId }, { status: 'shortlisted', shortlistedAt: new Date() });
        (0, notificationService_1.notifyApplicationShortlisted)(application.teacherId, 'your subject', application._id).catch(() => { });
        return res.status(200).json({
            success: true,
            message: 'Application shortlisted successfully',
            data: { application },
        });
    }
    catch (error) {
        console.error('Shortlist application error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to shortlist application',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.shortlistApplication = shortlistApplication;
const rejectApplication = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const { applicationId } = req.params;
        const { reason } = req.body;
        if (!parentId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const application = await TutorApplication_1.TutorApplication.findOne({
            applicationId,
            parentId,
        });
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found',
            });
        }
        application.status = 'rejected';
        application.rejectedAt = new Date();
        application.rejectionReason = reason;
        await application.save();
        await TutorMatch_1.TutorMatch.findOneAndUpdate({ requirementId: application.parentRequirementId, teacherId: application.teacherId }, { status: 'rejected', rejectedAt: new Date() });
        return res.status(200).json({
            success: true,
            message: 'Application rejected',
            data: { application },
        });
    }
    catch (error) {
        console.error('Reject application error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to reject application',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.rejectApplication = rejectApplication;
const acceptApplication = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const { applicationId } = req.params;
        if (!parentId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const application = await TutorApplication_1.TutorApplication.findOne({
            applicationId,
            parentId,
        });
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found',
            });
        }
        application.status = 'accepted';
        application.acceptedAt = new Date();
        await application.save();
        await TutorMatch_1.TutorMatch.findOneAndUpdate({ requirementId: application.parentRequirementId, teacherId: application.teacherId }, { status: 'hired', hiredAt: new Date() });
        const requirement = await ParentRequirement_1.ParentRequirement.findById(application.parentRequirementId);
        const teacherProfile = await TeacherProfile_1.TeacherProfile.findById(application.teacherProfileId);
        if (requirement && teacherProfile) {
            const scheduledClass = new ScheduledClass_1.ScheduledClass({
                parentId: application.parentId,
                teacherId: application.teacherId,
                teacherProfileId: application.teacherProfileId,
                requirementId: application.parentRequirementId,
                applicationId: application._id,
                subject: requirement.subjects[0],
                grade: requirement.studentDetails.grade,
                schedule: {
                    daysPerWeek: parseInt(requirement.schedule.daysPerWeek) || 3,
                    days: requirement.schedule.preferredTimings.slice(0, 3),
                    timeSlot: requirement.schedule.preferredTimings[0] || 'Evening',
                    startDate: new Date(),
                },
                fee: {
                    amount: application.proposedFee || requirement.budget.maxAmount || teacherProfile.pricingRevenue.hourlyRate,
                    currency: 'INR',
                    billingCycle: 'monthly',
                    paymentStatus: 'pending',
                },
                mode: requirement.tuitionType === 'home' ? 'home' : requirement.tuitionType === 'online' ? 'online' : 'home',
                location: {
                    address: requirement.location.address,
                    city: requirement.location.city,
                    pincode: requirement.location.pincode,
                    coordinates: requirement.location.coordinates,
                },
                status: 'active',
            });
            await scheduledClass.save();
            await TeacherProfile_1.TeacherProfile.findByIdAndUpdate(application.teacherProfileId, {
                $inc: {
                    'stats.activeStudents': 1,
                    'stats.totalStudents': 1,
                },
            });
            await ParentRequirement_1.ParentRequirement.findByIdAndUpdate(application.parentRequirementId, {
                status: 'closed',
                isActive: false,
            });
            await MatchingService_1.MatchingService.expireCompetingMatches(application.parentRequirementId, application.teacherId);
        }
        return res.status(200).json({
            success: true,
            message: 'Application accepted. Tutor assigned successfully.',
            data: {
                application,
                scheduledClass: requirement ? {
                    classId: requirement.subjects[0] + '-' + requirement.studentDetails.grade,
                    subject: requirement.subjects[0],
                    grade: requirement.studentDetails.grade,
                } : null,
            },
        });
    }
    catch (error) {
        console.error('Accept application error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to accept application',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.acceptApplication = acceptApplication;
const withdrawApplication = async (req, res) => {
    try {
        const teacherId = req.user?._id;
        const { applicationId } = req.params;
        if (!teacherId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const application = await TutorApplication_1.TutorApplication.findOne({
            applicationId,
            teacherId,
        });
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found',
            });
        }
        if (application.status === 'accepted') {
            return res.status(400).json({
                success: false,
                message: 'Cannot withdraw an accepted application',
            });
        }
        application.status = 'withdrawn';
        application.isActive = false;
        await application.save();
        await MatchingService_1.MatchingService.resetMatchOnWithdrawal(application.parentRequirementId, application.teacherId);
        return res.status(200).json({
            success: true,
            message: 'Application withdrawn successfully',
        });
    }
    catch (error) {
        console.error('Withdraw application error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to withdraw application',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.withdrawApplication = withdrawApplication;
const getParentDashboardStats = async (req, res) => {
    try {
        const parentId = req.user?._id;
        if (!parentId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const [activeRequirements, applicationsReceived, shortlistedTutors, upcomingDemos,] = await Promise.all([
            ParentRequirement_1.ParentRequirement.countDocuments({ parentId, status: 'active' }),
            TutorApplication_1.TutorApplication.countDocuments({ parentId, isActive: true }),
            TutorApplication_1.TutorApplication.countDocuments({ parentId, status: 'shortlisted' }),
            Promise.resolve(0),
        ]);
        return res.status(200).json({
            success: true,
            data: {
                activeRequirements,
                applicationsReceived,
                shortlistedTutors,
                demosScheduled: upcomingDemos,
            },
        });
    }
    catch (error) {
        console.error('Get parent dashboard stats error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch stats',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getParentDashboardStats = getParentDashboardStats;
const getTeacherDashboardStats = async (req, res) => {
    try {
        const teacherId = req.user?._id;
        if (!teacherId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const teacherProfile = await TeacherProfile_1.TeacherProfile.findOne({ userId: teacherId });
        const [matchingRequirements, applicationsSent, activeStudents,] = await Promise.all([
            TutorMatch_1.TutorMatch.countDocuments({ teacherId, status: 'recommended' }),
            TutorApplication_1.TutorApplication.countDocuments({ teacherId, isActive: true }),
            Promise.resolve(teacherProfile?.stats.activeStudents || 0),
        ]);
        return res.status(200).json({
            success: true,
            data: {
                activeStudents,
                tuitionRequestsAvailable: matchingRequirements,
                applicationsSent,
                monthlyEarnings: teacherProfile?.stats.totalEarnings || 0,
                profileCompletion: calculateProfileCompletion(teacherProfile),
                verificationStatus: teacherProfile?.verificationStatus || 'pending',
            },
        });
    }
    catch (error) {
        console.error('Get teacher dashboard stats error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch stats',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getTeacherDashboardStats = getTeacherDashboardStats;
function calculateProfileCompletion(profile) {
    if (!profile)
        return 0;
    const requiredFields = [
        'basicDetails.fullName',
        'basicDetails.mobileNumber',
        'basicDetails.email',
        'education.highestQualification',
        'teachingDetails.subjects',
        'teachingDetails.classes',
        'locationAvailability.city',
        'pricingRevenue.hourlyRate',
        'verificationDocuments.aadhaarCard',
    ];
    let filled = 0;
    for (const field of requiredFields) {
        const value = field.split('.').reduce((obj, key) => obj?.[key], profile);
        if (value && (Array.isArray(value) ? value.length > 0 : true)) {
            filled++;
        }
    }
    return Math.round((filled / requiredFields.length) * 100);
}
//# sourceMappingURL=applicationController.js.map