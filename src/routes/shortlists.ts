import express from 'express';
import {
  addToShortlist,
  removeFromShortlist,
  getParentShortlists,
  getTeacherShortlists,
  markShortlistContacted,
} from '../controllers/shortlistController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// Add to shortlist (Parent workflow)
router.post(
  '/',
  authenticate,
  authorize('parent', 'admin'),
  addToShortlist
);

// Remove from shortlist
router.delete(
  '/:id',
  authenticate,
  authorize('parent', 'admin'),
  removeFromShortlist
);

// Get shortlists for parent (Parent Dashboard)
router.get(
  '/parent',
  authenticate,
  authorize('parent', 'admin'),
  getParentShortlists
);

// Get shortlists where teacher appears (Teacher Dashboard)
router.get(
  '/teacher',
  authenticate,
  authorize('teacher'),
  getTeacherShortlists
);

// Mark as contacted
router.post(
  '/:id/contacted',
  authenticate,
  authorize('parent', 'admin'),
  markShortlistContacted
);

export default router;
