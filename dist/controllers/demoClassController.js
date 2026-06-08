"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeDemo = exports.cancelDemo = exports.rescheduleDemo = exports.getTeacherDemos = exports.getParentDemos = exports.scheduleDemo = void 0;
const DemoClass_1 = require("../models/DemoClass");
const TutorApplication_1 = require("../models/TutorApplication");
const scheduleDemo = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const { applicationId, teacherId, teacherProfileId, requirementId, studentName, grade, subject, scheduledDate, scheduledTime, duration, mode, meetingPlatform, meetingLink, } = req.body;
        if (!parentId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const application = await TutorApplication_1.TutorApplication.findOne({
            applicationId,
            parentId,
            status: 'shortlisted',
        });
        if (!application) {
            return res.status(404).json({
                success: false,
                message: 'Application not found or not shortlisted',
            });
        }
        const demoClass = new DemoClass_1.DemoClass({
            parentId,
            teacherId,
            teacherProfileId,
            requirementId,
            applicationId: application._id,
            studentDetails: {
                studentName,
                grade,
                subject,
            },
            scheduledDate: new Date(scheduledDate),
            scheduledTime,
            duration: duration || 60,
            mode: mode || 'online',
            meetingDetails: {
                platform: meetingPlatform || 'zoom',
                meetingLink,
            },
            status: 'scheduled',
        });
        await demoClass.save();
        application.demoScheduled = true;
        application.demoId = demoClass._id;
        await application.save();
        return res.status(201).json({
            success: true,
            message: 'Demo class scheduled successfully',
            data: {
                demoId: demoClass.demoId,
                demoClass,
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
const getParentDemos = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const { status } = req.query;
        if (!parentId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const query = { parentId, isActive: true };
        if (status)
            query.status = status;
        const demos = await DemoClass_1.DemoClass.find(query)
            .populate({
            path: 'teacherProfileId',
            select: 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects',
        })
            .populate({
            path: 'requirementId',
            select: 'requirementId subjects',
        })
            .sort({ scheduledDate: 1 });
        return res.status(200).json({
            success: true,
            data: {
                demos,
                total: demos.length,
            },
        });
    }
    catch (error) {
        console.error('Get parent demos error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch demos',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getParentDemos = getParentDemos;
const getTeacherDemos = async (req, res) => {
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
        const demos = await DemoClass_1.DemoClass.find(query)
            .populate({
            path: 'parentId',
            select: 'profile.parentName profile.mobileNumber',
        })
            .populate({
            path: 'requirementId',
            select: 'requirementId studentDetails subjects',
        })
            .sort({ scheduledDate: 1 });
        return res.status(200).json({
            success: true,
            data: {
                demos,
                total: demos.length,
            },
        });
    }
    catch (error) {
        console.error('Get teacher demos error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch demos',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getTeacherDemos = getTeacherDemos;
const rescheduleDemo = async (req, res) => {
    try {
        const userId = req.user?._id;
        const { demoId } = req.params;
        const { newDate, newTime, reason } = req.body;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const demo = await DemoClass_1.DemoClass.findOne({
            demoId,
            $or: [{ parentId: userId }, { teacherId: userId }],
        });
        if (!demo) {
            return res.status(404).json({
                success: false,
                message: 'Demo not found',
            });
        }
        demo.previousDates = demo.previousDates || [];
        demo.previousDates.push({
            date: demo.scheduledDate,
            time: demo.scheduledTime,
            reason: reason || 'Rescheduled',
        });
        demo.scheduledDate = new Date(newDate);
        demo.scheduledTime = newTime;
        demo.status = 'rescheduled';
        await demo.save();
        return res.status(200).json({
            success: true,
            message: 'Demo rescheduled successfully',
            data: { demo },
        });
    }
    catch (error) {
        console.error('Reschedule demo error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to reschedule demo',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.rescheduleDemo = rescheduleDemo;
const cancelDemo = async (req, res) => {
    try {
        const userId = req.user?._id;
        const { demoId } = req.params;
        const { reason } = req.body;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const demo = await DemoClass_1.DemoClass.findOne({
            demoId,
            $or: [{ parentId: userId }, { teacherId: userId }],
        });
        if (!demo) {
            return res.status(404).json({
                success: false,
                message: 'Demo not found',
            });
        }
        demo.status = 'cancelled';
        demo.isActive = false;
        demo.nextSteps = reason || 'Cancelled by user';
        await demo.save();
        return res.status(200).json({
            success: true,
            message: 'Demo cancelled successfully',
            data: { demo },
        });
    }
    catch (error) {
        console.error('Cancel demo error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to cancel demo',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.cancelDemo = cancelDemo;
const completeDemo = async (req, res) => {
    try {
        const userId = req.user?._id;
        const userRole = req.user?.role;
        const { demoId } = req.params;
        const { rating, comment, isInterested } = req.body;
        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const demo = await DemoClass_1.DemoClass.findOne({
            demoId,
            $or: [{ parentId: userId }, { teacherId: userId }],
        });
        if (!demo) {
            return res.status(404).json({
                success: false,
                message: 'Demo not found',
            });
        }
        demo.status = 'completed';
        if (userRole === 'parent' || demo.parentId.toString() === userId.toString()) {
            demo.feedback = {
                ...demo.feedback,
                parentFeedback: {
                    rating,
                    comment,
                    isInterested,
                    submittedAt: new Date(),
                },
            };
            demo.outcome = isInterested ? 'interested' : 'not_interested';
        }
        else {
            demo.feedback = {
                ...demo.feedback,
                teacherFeedback: {
                    rating,
                    comment,
                    isInterested,
                    submittedAt: new Date(),
                },
            };
        }
        await demo.save();
        return res.status(200).json({
            success: true,
            message: 'Demo marked as completed',
            data: { demo },
        });
    }
    catch (error) {
        console.error('Complete demo error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to complete demo',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.completeDemo = completeDemo;
//# sourceMappingURL=demoClassController.js.map