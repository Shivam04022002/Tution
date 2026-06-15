import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getRecommendedTutors,
  getRecommendationById,
  getRecommendationsByRequirement,
  trackTutorInteraction,
} from '../controllers/recommendationController';

const router = express.Router();

// ── Get All Recommended Tutors for Parent ───────────────────────────────────
// GET /api/recommendations/tutors?subject=Math&class=10&gender=male&minExperience=2&minRating=4&mode=online&city=Mumbai&sortBy=match&page=1&limit=20
router.get(
  '/tutors',
  authenticate,
  authorize('parent'),
  getRecommendedTutors
);

// ── Get Recommendations for Specific Requirement ─────────────────────────────
// GET /api/recommendations/requirements/:requirementId?subject=Math&sortBy=rating
router.get(
  '/requirements/:requirementId',
  authenticate,
  authorize('parent'),
  getRecommendationsByRequirement
);

// ── Get Single Recommendation Detail ──────────────────────────────────────────
// GET /api/recommendations/tutors/:id
router.get(
  '/tutors/:id',
  authenticate,
  authorize('parent'),
  getRecommendationById
);

// ── Track Tutor Interaction (Analytics) ──────────────────────────────────────
// POST /api/recommendations/tutors/:matchId/track
router.post(
  '/tutors/:matchId/track',
  authenticate,
  authorize('parent'),
  trackTutorInteraction
);

export default router;
