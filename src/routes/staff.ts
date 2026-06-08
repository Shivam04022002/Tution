import express from 'express';
import {
  getStaffDashboard,
  getVerificationQueue,
  getStaffReports,
} from '../controllers/staffController';
import {
  approveTeacher,
  rejectTeacher,
  getTeacherDetails,
} from '../controllers/adminController';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

router.use(authenticate, authorize('admin', 'staff'));

// Dashboard
router.get('/dashboard', getStaffDashboard);

// Verification queue
router.get('/verification-queue', getVerificationQueue);
router.get('/verification-queue/:id', getTeacherDetails);
router.patch('/verification-queue/:id/approve', approveTeacher);
router.patch('/verification-queue/:id/reject', rejectTeacher);


// Reports
router.get('/reports', getStaffReports);

export default router;
