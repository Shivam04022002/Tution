import express from 'express';
import {
  getParentDashboard,
  getTeacherDashboard,
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

export default router;
