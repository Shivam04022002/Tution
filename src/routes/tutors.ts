import express from 'express';
import {
  getTutorReviews,
  getTutorRatings,
  createReview,
} from '../controllers/reviewController';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';

const router = express.Router();

router.get('/:id/reviews', optionalAuth, getTutorReviews);
router.post('/:id/reviews', authenticate, authorize('parent'), createReview);
router.get('/:id/ratings', optionalAuth, getTutorRatings);

export default router;
