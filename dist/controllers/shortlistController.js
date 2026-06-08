"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markShortlistContacted = exports.getTeacherShortlists = exports.getParentShortlists = exports.removeFromShortlist = exports.addToShortlist = void 0;
const Shortlist_1 = require("../models/Shortlist");
const TutorApplication_1 = require("../models/TutorApplication");
const addToShortlist = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const { teacherId, teacherProfileId, requirementId, notes } = req.body;
        if (!parentId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const existingShortlist = await Shortlist_1.Shortlist.findOne({
            parentId,
            teacherId,
            requirementId,
            isDeleted: false,
        });
        if (existingShortlist) {
            return res.status(409).json({
                success: false,
                message: 'Teacher already shortlisted for this requirement',
                data: { shortlistId: existingShortlist._id },
            });
        }
        const application = await TutorApplication_1.TutorApplication.findOne({
            parentId,
            teacherId,
            parentRequirementId: requirementId,
        });
        const shortlist = new Shortlist_1.Shortlist({
            parentId,
            teacherId,
            teacherProfileId,
            requirementId,
            notes,
            matchScore: application ? 85 : 0,
            isContacted: false,
        });
        await shortlist.save();
        return res.status(201).json({
            success: true,
            message: 'Teacher added to shortlist',
            data: { shortlist },
        });
    }
    catch (error) {
        console.error('Add to shortlist error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to add to shortlist',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.addToShortlist = addToShortlist;
const removeFromShortlist = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const { id } = req.params;
        if (!parentId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const shortlist = await Shortlist_1.Shortlist.findOneAndUpdate({ _id: id, parentId }, { isDeleted: true }, { new: true });
        if (!shortlist) {
            return res.status(404).json({
                success: false,
                message: 'Shortlist entry not found',
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Removed from shortlist',
        });
    }
    catch (error) {
        console.error('Remove from shortlist error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to remove from shortlist',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.removeFromShortlist = removeFromShortlist;
const getParentShortlists = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const { requirementId } = req.query;
        if (!parentId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const query = { parentId, isDeleted: false };
        if (requirementId)
            query.requirementId = requirementId;
        const shortlists = await Shortlist_1.Shortlist.find(query)
            .populate({
            path: 'teacherProfileId',
            select: 'basicDetails.fullName basicDetails.profilePhoto teachingDetails.subjects teachingDetails.classes pricingRevenue.hourlyRate stats.averageRating education.highestQualification',
        })
            .populate({
            path: 'requirementId',
            select: 'requirementId studentDetails subjects status',
        })
            .sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            data: {
                shortlists,
                total: shortlists.length,
            },
        });
    }
    catch (error) {
        console.error('Get parent shortlists error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch shortlists',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getParentShortlists = getParentShortlists;
const getTeacherShortlists = async (req, res) => {
    try {
        const teacherId = req.user?._id;
        if (!teacherId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const shortlists = await Shortlist_1.Shortlist.find({
            teacherId,
            isDeleted: false,
        })
            .populate({
            path: 'parentId',
            select: 'profile.parentName profile.mobileNumber',
        })
            .populate({
            path: 'requirementId',
            select: 'requirementId studentDetails subjects budget',
        })
            .sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            data: {
                shortlists,
                total: shortlists.length,
            },
        });
    }
    catch (error) {
        console.error('Get teacher shortlists error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch shortlists',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.getTeacherShortlists = getTeacherShortlists;
const markShortlistContacted = async (req, res) => {
    try {
        const parentId = req.user?._id;
        const { id } = req.params;
        const { method } = req.body;
        if (!parentId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const shortlist = await Shortlist_1.Shortlist.findOneAndUpdate({ _id: id, parentId }, {
            isContacted: true,
            contactedAt: new Date(),
            contactMethod: method || 'call',
        }, { new: true });
        if (!shortlist) {
            return res.status(404).json({
                success: false,
                message: 'Shortlist entry not found',
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Marked as contacted',
            data: { shortlist },
        });
    }
    catch (error) {
        console.error('Mark contacted error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update shortlist',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};
exports.markShortlistContacted = markShortlistContacted;
//# sourceMappingURL=shortlistController.js.map