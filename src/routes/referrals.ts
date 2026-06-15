import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getMyReferralCode,
  getMyReferrals,
  trackReferralClick,
  registerWithReferral,
  processReferralReward,
  getAllReferrals,
  getTopReferrers,
} from '../controllers/referralController';

const router = express.Router();

// Teacher routes (require teacher role)
router.get('/my-code', authenticate, authorize('teacher'), getMyReferralCode);
router.get('/my-referrals', authenticate, authorize('teacher'), getMyReferrals);

// Public/registration routes (no auth required)
router.post('/track-click', trackReferralClick);
router.post('/register', registerWithReferral);

// Internal/Admin routes
router.post('/process-reward', authenticate, authorize('admin'), processReferralReward);

// Admin routes
router.get('/admin/all', authenticate, authorize('admin'), getAllReferrals);
router.get('/admin/top-referrers', authenticate, authorize('admin'), getTopReferrers);

export default router;
