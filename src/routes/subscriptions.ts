import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getPlans,
  getCurrentSubscription,
  selectPlan,
  cancelSubscription,
} from '../controllers/subscriptionController';

const router = express.Router();

// GET /api/subscriptions/plans — public (teachers can browse before auth)
router.get('/plans', authenticate, authorize('teacher', 'admin'), getPlans);

// GET /api/subscriptions/current — teacher only
router.get('/current', authenticate, authorize('teacher'), getCurrentSubscription);

// POST /api/subscriptions/select — teacher only
router.post('/select', authenticate, authorize('teacher'), selectPlan);

// POST /api/subscriptions/cancel — teacher only
router.post('/cancel', authenticate, authorize('teacher'), cancelSubscription);

export default router;
