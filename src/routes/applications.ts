import express from 'express';
import {
  applyToRequirement,
  getParentApplications,
  getTeacherApplications,
  getApplicationById,
  shortlistApplication,
  rejectApplication,
  withdrawApplication,
  scheduleDemo,
  getParentDashboardStats,
  getTeacherDashboardStats,
  getRequirementApplications,
  viewApplication,
  selectTeacher,
  hireTeacher,
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

// Get single application by ID (Parent or Teacher workflow)
router.get(
  '/:applicationId',
  authenticate,
  authorize('parent', 'teacher', 'admin'),
  getApplicationById
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

// View application (mark as viewed by parent)
router.post(
  '/:applicationId/view',
  authenticate,
  authorize('parent', 'admin'),
  viewApplication
);

// Select teacher (pre-hire step)
router.post(
  '/:applicationId/select',
  authenticate,
  authorize('parent', 'admin'),
  selectTeacher
);

// Hire teacher (finalize)
router.post(
  '/:applicationId/hire',
  authenticate,
  authorize('parent', 'admin'),
  hireTeacher
);

// Withdraw application (Teacher workflow)
router.post(
  '/:applicationId/withdraw',
  authenticate,
  authorize('teacher'),
  withdrawApplication
);

// Schedule demo for application (Parent workflow)
router.post(
  '/:applicationId/demo',
  authenticate,
  authorize('parent', 'admin'),
  scheduleDemo
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
