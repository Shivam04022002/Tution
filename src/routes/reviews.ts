import express from 'express';
import {
  updateReview,
  deleteReview,
  addTutorResponse,
  markReviewHelpful,
  getMyReviews,
} from '../controllers/reviewController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// Parent: view own reviews
router.get('/my', authenticate, authorize('parent'), getMyReviews);

// Edit own review (parent only)
router.put('/:id', authenticate, authorize('parent'), updateReview);

// Delete review (parent or admin)
router.delete('/:id', authenticate, authorize('parent', 'admin'), deleteReview);

// Tutor response to a review
router.post('/:id/respond', authenticate, authorize('teacher'), addTutorResponse);

// Mark review as helpful (any authenticated user)
router.post('/:id/helpful', authenticate, markReviewHelpful);

export default router;
