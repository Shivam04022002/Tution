"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const MatchingService_1 = require("../services/MatchingService");
const TutorMatch_1 = require("../models/TutorMatch");
const ParentRequirement_1 = require("../models/ParentRequirement");
const router = express_1.default.Router();
router.get('/marketplace/stats', auth_1.authenticate, (0, auth_1.authorize)('teacher'), async (req, res) => {
    try {
        const teacherId = req.user?._id;
        if (!teacherId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const now = new Date();
        const HIGH_MATCH_THRESHOLD = 70;
        const NEARBY_DISTANCE_KM = 5;
        const [available, highMatch, nearby, unlocked] = await Promise.all([
            TutorMatch_1.TutorMatch.countDocuments({
                teacherId,
                isActive: true,
                expiryDate: { $gte: now },
            }),
            TutorMatch_1.TutorMatch.countDocuments({
                teacherId,
                isActive: true,
                expiryDate: { $gte: now },
                overallScore: { $gte: HIGH_MATCH_THRESHOLD },
            }),
            TutorMatch_1.TutorMatch.countDocuments({
                teacherId,
                isActive: true,
                expiryDate: { $gte: now },
                'breakdown.locationMatchDetails.distance': { $lte: NEARBY_DISTANCE_KM },
            }),
            TutorMatch_1.TutorMatch.countDocuments({
                teacherId,
                status: { $in: ['applied', 'shortlisted', 'hired'] },
            }),
        ]);
        return res.status(200).json({
            success: true,
            data: {
                availableLeads: available,
                highMatchLeads: highMatch,
                nearbyLeads: nearby,
                unlockedLeads: unlocked,
            },
        });
    }
    catch (error) {
        console.error('Lead marketplace stats error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch marketplace stats',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/marketplace', auth_1.authenticate, (0, auth_1.authorize)('teacher'), async (req, res) => {
    try {
        const teacherId = req.user?._id;
        if (!teacherId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
        const skip = (page - 1) * limit;
        const { subject, city, teachingMode, sortBy } = req.query;
        const now = new Date();
        const matchQuery = {
            teacherId,
            isActive: true,
            expiryDate: { $gte: now },
        };
        let requirementIdFilter = undefined;
        if (subject && subject.trim()) {
            const reqs = await ParentRequirement_1.ParentRequirement.find({ subjects: { $regex: new RegExp(subject.trim(), 'i') } }, { _id: 1 }).lean();
            requirementIdFilter = reqs.map((r) => r._id);
            if (requirementIdFilter.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: {
                        matches: [],
                        pagination: { page, limit, total: 0, totalPages: 0 },
                    },
                });
            }
            matchQuery.requirementId = { $in: requirementIdFilter };
        }
        if (city && city.trim()) {
            const cityReqs = await ParentRequirement_1.ParentRequirement.find({ 'location.city': { $regex: new RegExp(city.trim(), 'i') } }, { _id: 1 }).lean();
            const cityIds = cityReqs.map((r) => r._id);
            if (cityIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: { matches: [], pagination: { page, limit, total: 0, totalPages: 0 } },
                });
            }
            if (matchQuery.requirementId && matchQuery.requirementId.$in) {
                const existing = matchQuery.requirementId.$in;
                matchQuery.requirementId.$in = existing.filter((id) => cityIds.some((c) => c.toString() === id.toString()));
            }
            else {
                matchQuery.requirementId = { $in: cityIds };
            }
            if (matchQuery.requirementId.$in.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: { matches: [], pagination: { page, limit, total: 0, totalPages: 0 } },
                });
            }
        }
        if (teachingMode && teachingMode.trim()) {
            const modeReqs = await ParentRequirement_1.ParentRequirement.find({ tuitionType: { $regex: new RegExp(teachingMode.trim(), 'i') } }, { _id: 1 }).lean();
            const modeIds = modeReqs.map((r) => r._id);
            if (modeIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: { matches: [], pagination: { page, limit, total: 0, totalPages: 0 } },
                });
            }
            if (matchQuery.requirementId && matchQuery.requirementId.$in) {
                const existing = matchQuery.requirementId.$in;
                matchQuery.requirementId.$in = existing.filter((id) => modeIds.some((m) => m.toString() === id.toString()));
            }
            else {
                matchQuery.requirementId = { $in: modeIds };
            }
            if (matchQuery.requirementId.$in.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: { matches: [], pagination: { page, limit, total: 0, totalPages: 0 } },
                });
            }
        }
        const sortMap = {
            score: { overallScore: -1 },
            distance: { 'breakdown.locationMatchDetails.distance': 1 },
            recent: { createdAt: -1 },
            budget: { createdAt: -1 },
        };
        const sort = sortMap[sortBy] || sortMap.score;
        const [total, matches] = await Promise.all([
            TutorMatch_1.TutorMatch.countDocuments(matchQuery),
            TutorMatch_1.TutorMatch.find(matchQuery)
                .populate({
                path: 'requirementId',
                select: 'requirementId studentDetails subjects budget location schedule tuitionType board status',
            })
                .sort(sort)
                .skip(skip)
                .limit(limit),
        ]);
        const totalPages = Math.ceil(total / limit);
        const enriched = matches.map((m) => {
            const obj = m.toObject();
            obj.distanceKm = obj.breakdown?.locationMatchDetails?.distance ?? null;
            obj.teacherServiceRadius = obj.breakdown?.locationMatchDetails?.teachingRadius ?? null;
            obj.requirement = obj.requirementId;
            return obj;
        });
        return res.status(200).json({
            success: true,
            data: {
                matches: enriched,
                pagination: { page, limit, total, totalPages },
            },
        });
    }
    catch (error) {
        console.error('Lead marketplace error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch marketplace leads',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/teacher', auth_1.authenticate, (0, auth_1.authorize)('teacher'), async (req, res) => {
    try {
        const teacherId = req.user?._id;
        const { status } = req.query;
        if (!teacherId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }
        const matches = await MatchingService_1.MatchingService.getMatchesForTeacher(teacherId, status);
        return res.status(200).json({
            success: true,
            data: {
                matches,
                total: matches.length,
            },
        });
    }
    catch (error) {
        console.error('Get teacher matches error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch matches',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.get('/requirement/:requirementId', auth_1.authenticate, (0, auth_1.authorize)('parent', 'admin'), async (req, res) => {
    try {
        const { requirementId } = req.params;
        const { status } = req.query;
        const matches = await MatchingService_1.MatchingService.getMatchesForRequirement(requirementId, status);
        return res.status(200).json({
            success: true,
            data: {
                matches,
                total: matches.length,
            },
        });
    }
    catch (error) {
        console.error('Get requirement matches error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch matches',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.post('/:matchId/view', auth_1.authenticate, (0, auth_1.authorize)('teacher'), async (req, res) => {
    try {
        const matchId = req.params.matchId;
        await MatchingService_1.MatchingService.updateMatchStatus(matchId, 'viewed');
        return res.status(200).json({
            success: true,
            message: 'Match marked as viewed',
        });
    }
    catch (error) {
        console.error('Update match status error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update match',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.post('/run-matching-engine', auth_1.authenticate, (0, auth_1.authorize)('admin'), async (req, res) => {
    try {
        const result = await MatchingService_1.MatchingService.runMatchingEngine();
        return res.status(200).json({
            success: true,
            message: 'Matching engine executed successfully',
            data: result,
        });
    }
    catch (error) {
        console.error('Run matching engine error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to run matching engine',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
router.post('/generate/:requirementId', auth_1.authenticate, (0, auth_1.authorize)('admin', 'parent'), async (req, res) => {
    try {
        const { requirementId } = req.params;
        const requirement = await ParentRequirement_1.ParentRequirement.findById(requirementId);
        if (!requirement) {
            return res.status(404).json({ success: false, message: 'Requirement not found' });
        }
        const count = await MatchingService_1.MatchingService.generateAndSaveForRequirement(requirement);
        return res.status(200).json({
            success: true,
            message: `Generated ${count} new matches`,
            data: { requirementId, newMatches: count },
        });
    }
    catch (error) {
        console.error('Generate matches error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to generate matches',
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=matches.js.map