import express from 'express';
import {
  getParentDashboard,
  getTeacherDashboard,
  getParentQuickStats,
} from '../controllers/dashboardController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// Parent Dashboard - Aggregated data
router.get(
  '/parent',
  authenticate,
  authorize('parent'),
  getParentDashboard
);

// Teacher Dashboard - Aggregated data
router.get(
  '/teacher',
  authenticate,
  authorize('teacher'),
  getTeacherDashboard
);

// Parent Quick Stats - Lightweight stats only
router.get(
  '/parent/stats',
  authenticate,
  authorize('parent'),
  getParentQuickStats
);

export default router;
