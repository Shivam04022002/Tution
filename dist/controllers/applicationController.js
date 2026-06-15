"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeRequirement = exports.hireTeacher = exports.selectTeacher = exports.viewApplication = exports.getRequirementApplications = exports.scheduleDemo = exports.getApplicationById = exports.getTeacherDashboardStats = exports.getParentDashboardStats = exports.withdrawApplication = exports.rejectApplication = exports.shortlistApplication = exports.getTeacherApplications = exports.getParentApplications = exports.applyToRequirement = void 0;
const TutorApplication_1 = require("../models/TutorApplication");
const ParentRequirement_1 = require("../models/ParentRequirement");
const TeacherProfile_1 = require("../models/TeacherProfile");
const TutorMatch_1 = require("../models/TutorMatch");
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
        if (!['published', 'receiving_applications', 'shortlisted'].includes(requirement.status)) {
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
            status: { $nin: ['rejected', 'withdrawn'] },
        });
        if (existingApplication) {
            return res.status(409).json({
                success: false,
                message: 'You have already applied to this requirement',
                data: { applicationId: existingApplication.applicationId },
            });
        }
        if (!['published', 'receiving_applications', 'shortlisted'].includes(requirement.status)) {
            return res.status(400).json({
                success: false,
                message: 'This requirement is no longer accepting applications',
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
        await ParentRequirement_1.ParentRequirement.findByIdAndUpdate(requirementId, {
            $inc: { applicationsCount: 1 },
        });
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
        await ParentRequirement_1.ParentRequirement.findByIdAndUpdate(application.parentRequirementId, {
            $inc: { shortlistedCount: 1 },
        });
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
        (0, notificationService_1.notifyApplicationRejected)(application.teacherId, application._id, reason).catch(() => { });
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
        if (['hired', 'selected'].includes(application.status)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot withdraw a hired or selected application',
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
            ParentRequirement_1.ParentRequirement.countDocuments({
                parentId,
                status: { $in: ['published', 'receiving_applications', 'shortlisted', 'demo_scheduled'] },
            }),
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
const getApplicationById = async (req, res) => {
    try {
        const userId = req.user?._id;
        const userRole = req.user?.role;
        const { applicationId } = req.params;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const query = { applicationId };
        if (userRole === 'parent' || userRole === 'admin') {
            query.parentId = userId;
        }
        else if (userRole === 'teacher') {
            query.teacherId = userId;
        }
        else {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized access',
            });
        }
        let populateOptions = [
            {
                path: 'parentRequirementId',
                select: 'requirementId studentDetails subjects budget tuitionType location schedule board preferredGender preferredLanguages additionalNotes',
            },
        ];
        if (userRole === 'teacher') {
            populateOptions.push({
                path: 'parentId',
                select: 'profile.parentName profile.mobileNumber email',
            });
        }
        else {
            populateOptions.push({
                path: 'teacherProfileId',
                select: 'basicDetails.fullName basicDetails.profilePhoto basicDetails.bio basicDetails.languages teachingDetails.subjects teachingDetails.classes teachingDetails.teachingModes education.highestQualification education.institutions pricingRevenue.hourlyRate pricingRevenue.experienceYears stats.averageRating stats.totalReviews verificationStatus',
            });
        }
        populateOptions.push({
            path: 'demoId',
            select: 'demoId scheduledDate scheduledTime duration mode status meetingDetails feedback',
        });
        const application = await TutorApplication_1.TutorApplication.findOne(query)
            .populate(populateOptions[0])
            .populate(populateOptions[1])
            .populate(populateOptions[2]);
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found',
            });
        }
        if ((userRole === 'parent' || userRole === 'admin') && !application.viewedByParent) {
            application.viewedByParent = true;
            application.viewedAt = new Date();
            await application.save();
        }
        return res.status(200).json({
            success: true,
            data: { application },
        });
    }
    catch (error) {
        console.error('Get application by ID error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch application',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getApplicationById = getApplicationById;
const scheduleDemo = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const { applicationId } = req.params;
        const { scheduledDate, scheduledTime, duration, mode, notes } = req.body;
        if (!parentId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        if (!scheduledDate || !scheduledTime) {
            return res.status(400).json({
                success: false,
                message: 'Date and time are required',
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
        if (application.status === 'rejected' || application.status === 'withdrawn') {
            return res.status(400).json({
                success: false,
                message: 'Cannot schedule demo for rejected or withdrawn application',
            });
        }
        const { DemoClass } = await Promise.resolve().then(() => __importStar(require('../models/DemoClass')));
        const demoClass = new DemoClass({
            parentId: application.parentId,
            teacherId: application.teacherId,
            teacherProfileId: application.teacherProfileId,
            requirementId: application.parentRequirementId,
            applicationId: application._id,
            scheduledDate,
            scheduledTime,
            duration: duration || 60,
            mode: mode || 'online',
            notes,
            status: 'scheduled',
        });
        await demoClass.save();
        application.demoScheduled = true;
        application.demoId = demoClass._id;
        await application.save();
        return res.status(201).json({
            success: true,
            message: 'Demo scheduled successfully',
            data: {
                demoId: demoClass.demoId,
                demoClass,
                application,
            },
        });
    }
    catch (error) {
        console.error('Schedule demo error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to schedule demo',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.scheduleDemo = scheduleDemo;
const getRequirementApplications = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const userRole = req.user?.role;
        const { id: requirementId } = req.params;
        const { status, page = 1, limit = 20 } = req.query;
        if (!parentId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const requirement = await ParentRequirement_1.ParentRequirement.findById(requirementId);
        if (!requirement) {
            return res.status(404).json({ success: false, message: 'Requirement not found' });
        }
        if (requirement.parentId.toString() !== parentId.toString() && userRole !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to view these applications' });
        }
        const query = { parentRequirementId: requirementId, isActive: true };
        if (status)
            query.status = status;
        const skip = (Number(page) - 1) * Number(limit);
        const [applications, total] = await Promise.all([
            TutorApplication_1.TutorApplication.find(query)
                .populate({
                path: 'teacherProfileId',
                select: 'basicDetails.fullName basicDetails.profilePhoto basicDetails.mobileNumber basicDetails.email teachingDetails.subjects teachingDetails.classes teachingDetails.teachingModes education.highestQualification pricingRevenue.hourlyRate pricingRevenue.monthlyRate pricingRevenue.experienceYears stats.averageRating stats.totalReviews stats.totalStudents verificationStatus',
            })
                .populate({
                path: 'demoId',
                select: 'demoDate demoTime demoMode status demoFeedback',
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            TutorApplication_1.TutorApplication.countDocuments(query),
        ]);
        const statusBreakdown = await TutorApplication_1.TutorApplication.aggregate([
            { $match: { parentRequirementId: requirement._id, isActive: true } },
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $project: { _id: 0, status: '$_id', count: 1 } },
        ]);
        return res.status(200).json({
            success: true,
            data: {
                applications,
                pagination: {
                    page: Number(page),
                    limit: Number(limit),
                    total,
                    hasMore: total > skip + applications.length,
                },
                statusBreakdown,
                requirement: {
                    _id: requirement._id,
                    requirementId: requirement.requirementId,
                    studentDetails: requirement.studentDetails,
                    subjects: requirement.subjects,
                    status: requirement.status,
                },
            },
        });
    }
    catch (error) {
        console.error('Get requirement applications error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch applications',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getRequirementApplications = getRequirementApplications;
const viewApplication = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const { id: applicationId } = req.params;
        if (!parentId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const application = await TutorApplication_1.TutorApplication.findOne({
            _id: applicationId,
            parentId,
        });
        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }
        await application.markAsViewed();
        (0, notificationService_1.notifyApplicationViewed)(application.teacherId, application._id).catch(() => { });
        return res.status(200).json({
            success: true,
            message: 'Application marked as viewed',
            data: { application },
        });
    }
    catch (error) {
        console.error('View application error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to view application',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.viewApplication = viewApplication;
const selectTeacher = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const { id: applicationId } = req.params;
        const { reason } = req.body;
        if (!parentId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const application = await TutorApplication_1.TutorApplication.findOne({
            _id: applicationId,
            parentId,
        }).populate('teacherProfileId');
        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }
        if (!['shortlisted', 'demo_completed'].includes(application.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot select teacher from ${application.status} status. Must be shortlisted or demo completed.`,
            });
        }
        await application.markAsSelected(reason);
        const requirement = await ParentRequirement_1.ParentRequirement.findById(application.parentRequirementId);
        if (requirement) {
            requirement.hiredTeacherId = application.teacherId;
            requirement.hiredTeacherProfileId = application.teacherProfileId?._id || application.teacherProfileId;
            requirement.hireReason = reason;
            await requirement.save();
        }
        (0, notificationService_1.notifyTeacherSelected)(application.teacherId, requirement?.subjects?.[0] || 'your subject', application._id).catch(() => { });
        await TutorApplication_1.TutorApplication.updateMany({
            parentRequirementId: application.parentRequirementId,
            _id: { $ne: application._id },
            status: { $in: ['pending', 'viewed', 'shortlisted', 'demo_scheduled'] },
        }, {
            status: 'rejected',
            rejectedAt: new Date(),
            rejectionReason: 'Another teacher was selected for this requirement',
        });
        return res.status(200).json({
            success: true,
            message: 'Teacher selected successfully',
            data: { application, requirement },
        });
    }
    catch (error) {
        console.error('Select teacher error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to select teacher',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.selectTeacher = selectTeacher;
const hireTeacher = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const { id: applicationId } = req.params;
        const { notes, startDate } = req.body;
        if (!parentId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const application = await TutorApplication_1.TutorApplication.findOne({
            _id: applicationId,
            parentId,
        }).populate('teacherProfileId');
        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }
        if (application.status !== 'selected') {
            return res.status(400).json({
                success: false,
                message: `Cannot hire from ${application.status} status. Teacher must be selected first.`,
            });
        }
        await application.markAsHired(notes);
        const requirement = await ParentRequirement_1.ParentRequirement.findById(application.parentRequirementId);
        if (requirement) {
            requirement.hiredAt = new Date();
            requirement.hiredTeacherId = application.teacherId;
            requirement.hiredTeacherProfileId = application.teacherProfileId?._id || application.teacherProfileId;
            requirement.status = 'hired';
            requirement.isActive = false;
            requirement.closedReason = 'Teacher hired successfully';
            requirement.closedAt = new Date();
            await requirement.save();
        }
        const { ScheduledClass } = await Promise.resolve().then(() => __importStar(require('../models/ScheduledClass')));
        if (requirement) {
            const scheduledClass = new ScheduledClass({
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
                    startDate: startDate ? new Date(startDate) : new Date(),
                },
                fee: {
                    amount: application.proposedFee || requirement.budget.maxAmount,
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
        }
        await TeacherProfile_1.TeacherProfile.findByIdAndUpdate(application.teacherProfileId, {
            $inc: {
                'stats.activeStudents': 1,
                'stats.totalStudents': 1,
            },
        });
        (0, notificationService_1.notifyTeacherHired)(application.teacherId, requirement?.subjects?.[0] || 'your subject', requirement?.studentDetails?.studentName || 'Student', application._id).catch(() => { });
        return res.status(200).json({
            success: true,
            message: 'Teacher hired successfully. Requirement closed.',
            data: { application, requirement },
        });
    }
    catch (error) {
        console.error('Hire teacher error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to hire teacher',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.hireTeacher = hireTeacher;
const closeRequirement = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const userRole = req.user?.role;
        const { id: requirementId } = req.params;
        const { reason } = req.body;
        if (!parentId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const requirement = await ParentRequirement_1.ParentRequirement.findById(requirementId);
        if (!requirement) {
            return res.status(404).json({ success: false, message: 'Requirement not found' });
        }
        if (requirement.parentId.toString() !== parentId.toString() && userRole !== 'admin') {
            return res.status(403).json({ success: false, message: 'Not authorized to close this requirement' });
        }
        if (requirement.status === 'hired') {
            return res.status(400).json({ success: false, message: 'Cannot close an already hired requirement' });
        }
        requirement.status = 'closed';
        requirement.isActive = false;
        requirement.closedReason = reason || 'Closed by parent';
        requirement.closedAt = new Date();
        await requirement.save();
        await TutorApplication_1.TutorApplication.updateMany({
            parentRequirementId: requirementId,
            status: { $in: ['pending', 'viewed', 'shortlisted', 'demo_scheduled', 'demo_completed', 'selected'] },
        }, {
            status: 'rejected',
            rejectedAt: new Date(),
            rejectionReason: 'Requirement was closed by parent',
        });
        const applications = await TutorApplication_1.TutorApplication.find({
            parentRequirementId: requirementId,
            isActive: true,
        });
        for (const app of applications) {
            (0, notificationService_1.notifyRequirementClosed)(app.teacherId, requirement.requirementId, reason || 'Requirement closed by parent').catch(() => { });
        }
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