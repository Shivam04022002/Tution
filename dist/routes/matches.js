"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const MatchingService_1 = require("../services/MatchingService");
const ParentRequirement_1 = require("../models/ParentRequirement");
const router = express_1.default.Router();
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