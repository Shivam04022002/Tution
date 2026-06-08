import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { MatchingService } from '../services/MatchingService';
import { TutorMatch } from '../models/TutorMatch';
import { ParentRequirement } from '../models/ParentRequirement';
import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';

const router = express.Router();

// ── Lead Marketplace Stats ────────────────────────────────────────────────────
// GET /api/matches/marketplace/stats
router.get(
  '/marketplace/stats',
  authenticate,
  authorize('teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const teacherId = req.user?._id;
      if (!teacherId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const now = new Date();
      const HIGH_MATCH_THRESHOLD = 70;
      const NEARBY_DISTANCE_KM   = 5;

      const [available, highMatch, nearby, unlocked] = await Promise.all([
        // Total active leads available to this teacher
        TutorMatch.countDocuments({
          teacherId,
          isActive: true,
          expiryDate: { $gte: now },
        }),
        // High-match leads (score ≥ 70)
        TutorMatch.countDocuments({
          teacherId,
          isActive: true,
          expiryDate: { $gte: now },
          overallScore: { $gte: HIGH_MATCH_THRESHOLD },
        }),
        // Nearby leads (distance stored in breakdown.locationMatchDetails.distance ≤ 5 km)
        TutorMatch.countDocuments({
          teacherId,
          isActive: true,
          expiryDate: { $gte: now },
          'breakdown.locationMatchDetails.distance': { $lte: NEARBY_DISTANCE_KM },
        }),
        // Applied/shortlisted/hired leads = "unlocked" in UI context
        TutorMatch.countDocuments({
          teacherId,
          status: { $in: ['applied', 'shortlisted', 'hired'] },
        }),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          availableLeads: available,
          highMatchLeads: highMatch,
          nearbyLeads:    nearby,
          unlockedLeads:  unlocked,
        },
      });
    } catch (error) {
      console.error('Lead marketplace stats error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch marketplace stats',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ── Lead Marketplace Feed (paginated + filtered) ───────────────────────────────
// GET /api/matches/marketplace?page=1&limit=10&subject=Math&city=Mumbai&teachingMode=online&sortBy=score
router.get(
  '/marketplace',
  authenticate,
  authorize('teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const teacherId = req.user?._id;
      if (!teacherId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      // ── Pagination ────────────────────────────────────────────────────────
      const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
      const limit  = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
      const skip   = (page - 1) * limit;

      // ── Filters ───────────────────────────────────────────────────────────
      const { subject, city, teachingMode, sortBy } = req.query as Record<string, string>;

      const now = new Date();

      // Base match query — always scope to this teacher's live matches
      const matchQuery: Record<string, any> = {
        teacherId,
        isActive: true,
        expiryDate: { $gte: now },
      };

      // Subject filter: stored in populated requirementId.subjects — use a two-step approach
      // Build a requirementIds sub-query if subject filter is set
      let requirementIdFilter: any = undefined;
      if (subject && subject.trim()) {
        const reqs = await ParentRequirement.find(
          { subjects: { $regex: new RegExp(subject.trim(), 'i') } },
          { _id: 1 }
        ).lean();
        requirementIdFilter = reqs.map((r: any) => r._id);
        if (requirementIdFilter.length === 0) {
          // No requirements match → return empty immediately
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

      // City filter
      if (city && city.trim()) {
        const cityReqs = await ParentRequirement.find(
          { 'location.city': { $regex: new RegExp(city.trim(), 'i') } },
          { _id: 1 }
        ).lean();
        const cityIds = cityReqs.map((r: any) => r._id);
        if (cityIds.length === 0) {
          return res.status(200).json({
            success: true,
            data: { matches: [], pagination: { page, limit, total: 0, totalPages: 0 } },
          });
        }
        if (matchQuery.requirementId && matchQuery.requirementId.$in) {
          const existing: any[] = matchQuery.requirementId.$in;
          matchQuery.requirementId.$in = existing.filter((id: any) =>
            cityIds.some((c: any) => c.toString() === id.toString())
          );
        } else {
          matchQuery.requirementId = { $in: cityIds };
        }
        if (matchQuery.requirementId.$in.length === 0) {
          return res.status(200).json({
            success: true,
            data: { matches: [], pagination: { page, limit, total: 0, totalPages: 0 } },
          });
        }
      }

      // Teaching mode filter
      if (teachingMode && teachingMode.trim()) {
        const modeReqs = await ParentRequirement.find(
          { tuitionType: { $regex: new RegExp(teachingMode.trim(), 'i') } },
          { _id: 1 }
        ).lean();
        const modeIds = modeReqs.map((r: any) => r._id);
        if (modeIds.length === 0) {
          return res.status(200).json({
            success: true,
            data: { matches: [], pagination: { page, limit, total: 0, totalPages: 0 } },
          });
        }
        if (matchQuery.requirementId && matchQuery.requirementId.$in) {
          const existing: any[] = matchQuery.requirementId.$in;
          matchQuery.requirementId.$in = existing.filter((id: any) =>
            modeIds.some((m: any) => m.toString() === id.toString())
          );
        } else {
          matchQuery.requirementId = { $in: modeIds };
        }
        if (matchQuery.requirementId.$in.length === 0) {
          return res.status(200).json({
            success: true,
            data: { matches: [], pagination: { page, limit, total: 0, totalPages: 0 } },
          });
        }
      }

      // ── Sort ──────────────────────────────────────────────────────────────
      const sortMap: Record<string, Record<string, 1 | -1>> = {
        score:    { overallScore: -1 },
        distance: { 'breakdown.locationMatchDetails.distance': 1 },
        recent:   { createdAt: -1 },
        budget:   { createdAt: -1 }, // budget sort requires populate; default to recent
      };
      const sort = sortMap[sortBy] || sortMap.score;

      // ── Count + fetch ─────────────────────────────────────────────────────
      const [total, matches] = await Promise.all([
        TutorMatch.countDocuments(matchQuery),
        TutorMatch.find(matchQuery)
          .populate({
            path: 'requirementId',
            select: 'requirementId studentDetails subjects budget location schedule tuitionType board status',
          })
          .sort(sort)
          .skip(skip)
          .limit(limit),
      ]);

      const totalPages = Math.ceil(total / limit);

      // Normalise: expose distanceKm from breakdown for the mobile client
      const enriched = matches.map((m: any) => {
        const obj = m.toObject();
        obj.distanceKm                 = obj.breakdown?.locationMatchDetails?.distance ?? null;
        obj.teacherServiceRadius       = obj.breakdown?.locationMatchDetails?.teachingRadius ?? null;
        obj.requirement                = obj.requirementId; // alias for existing UI field names
        return obj;
      });

      return res.status(200).json({
        success: true,
        data: {
          matches: enriched,
          pagination: { page, limit, total, totalPages },
        },
      });
    } catch (error) {
      console.error('Lead marketplace error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch marketplace leads',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Get matching requirements for teacher (Teacher Dashboard)
router.get(
  '/teacher',
  authenticate,
  authorize('teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const teacherId = req.user?._id;
      const { status } = req.query;

      if (!teacherId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const matches = await MatchingService.getMatchesForTeacher(
        teacherId,
        status as string
      );

      return res.status(200).json({
        success: true,
        data: {
          matches,
          total: matches.length,
        },
      });
    } catch (error) {
      console.error('Get teacher matches error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch matches',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Get matches for a specific requirement (Parent Dashboard)
router.get(
  '/requirement/:requirementId',
  authenticate,
  authorize('parent', 'admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { requirementId } = req.params;
      const { status } = req.query;

      const matches = await MatchingService.getMatchesForRequirement(
        requirementId as any,
        status as string
      );

      return res.status(200).json({
        success: true,
        data: {
          matches,
          total: matches.length,
        },
      });
    } catch (error) {
      console.error('Get requirement matches error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch matches',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Update match status (viewed)
router.post(
  '/:matchId/view',
  authenticate,
  authorize('teacher'),
  async (req: AuthRequest, res: Response) => {
    try {
      const matchId = req.params.matchId as string;

      await MatchingService.updateMatchStatus(matchId, 'viewed');

      return res.status(200).json({
        success: true,
        message: 'Match marked as viewed',
      });
    } catch (error) {
      console.error('Update match status error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update match',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Admin - Run matching engine manually (batch)
router.post(
  '/run-matching-engine',
  authenticate,
  authorize('admin'),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await MatchingService.runMatchingEngine();

      return res.status(200).json({
        success: true,
        message: 'Matching engine executed successfully',
        data: result,
      });
    } catch (error) {
      console.error('Run matching engine error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to run matching engine',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// Admin/Parent - Generate matches for a single requirement on demand
router.post(
  '/generate/:requirementId',
  authenticate,
  authorize('admin', 'parent'),
  async (req: AuthRequest, res: Response) => {
    try {
      const { requirementId } = req.params;

      const requirement = await ParentRequirement.findById(requirementId);
      if (!requirement) {
        return res.status(404).json({ success: false, message: 'Requirement not found' });
      }

      const count = await MatchingService.generateAndSaveForRequirement(requirement);

      return res.status(200).json({
        success: true,
        message: `Generated ${count} new matches`,
        data: { requirementId, newMatches: count },
      });
    } catch (error) {
      console.error('Generate matches error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate matches',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
