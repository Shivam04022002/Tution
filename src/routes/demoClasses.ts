import express from 'express';
import {
  scheduleDemo,
  getParentDemos,
  getTeacherDemos,
  rescheduleDemo,
  cancelDemo,
  completeDemo,
} from '../controllers/demoClassController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// Schedule a demo (Parent workflow)
router.post(
  '/schedule',
  authenticate,
  authorize('parent', 'admin'),
  scheduleDemo
);

// Get demos for parent (Parent Dashboard)
router.get(
  '/parent',
  authenticate,
  authorize('parent', 'admin'),
  getParentDemos
);

// Get demos for teacher (Teacher Dashboard)
router.get(
  '/teacher',
  authenticate,
  authorize('teacher'),
  getTeacherDemos
);

// Reschedule demo
router.put(
  '/:demoId/reschedule',
  authenticate,
  authorize('parent', 'teacher', 'admin'),
  rescheduleDemo
);

// Cancel demo
router.put(
  '/:demoId/cancel',
  authenticate,
  authorize('parent', 'teacher', 'admin'),
  cancelDemo
);

// Complete demo with feedback
router.put(
  '/:demoId/complete',
  authenticate,
  authorize('parent', 'teacher', 'admin'),
  completeDemo
);

export default router;
