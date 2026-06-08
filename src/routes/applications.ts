import express from 'express';
import {
  applyToRequirement,
  getParentApplications,
  getTeacherApplications,
  shortlistApplication,
  rejectApplication,
  acceptApplication,
  withdrawApplication,
  getParentDashboardStats,
  getTeacherDashboardStats,
} from '../controllers/applicationController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// Teacher workflow - Apply to requirement
router.post(
  '/apply/:requirementId',
  authenticate,
  authorize('teacher'),
  applyToRequirement
);

// Get applications for parent (Parent Dashboard)
router.get(
  '/parent',
  authenticate,
  authorize('parent', 'admin'),
  getParentApplications
);

// Get applications sent by teacher (Teacher Dashboard)
router.get(
  '/teacher',
  authenticate,
  authorize('teacher'),
  getTeacherApplications
);

// Shortlist application (Parent workflow)
router.post(
  '/:applicationId/shortlist',
  authenticate,
  authorize('parent', 'admin'),
  shortlistApplication
);

// Reject application (Parent workflow)
router.post(
  '/:applicationId/reject',
  authenticate,
  authorize('parent', 'admin'),
  rejectApplication
);

// Accept application (Parent workflow)
router.post(
  '/:applicationId/accept',
  authenticate,
  authorize('parent', 'admin'),
  acceptApplication
);

// Withdraw application (Teacher workflow)
router.post(
  '/:applicationId/withdraw',
  authenticate,
  authorize('teacher'),
  withdrawApplication
);

// Dashboard stats
router.get(
  '/stats/parent',
  authenticate,
  authorize('parent', 'admin'),
  getParentDashboardStats
);

router.get(
  '/stats/teacher',
  authenticate,
  authorize('teacher'),
  getTeacherDashboardStats
);

export default router;
