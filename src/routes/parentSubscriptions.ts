import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getParentPlans,
  getParentSubscriptionStatus,
  createParentSubscriptionOrder,
  verifyParentSubscriptionPayment,
} from '../controllers/parentSubscriptionController';

const router = express.Router();

router.get('/plans', authenticate, authorize('parent', 'admin'), getParentPlans);
router.get('/status', authenticate, authorize('parent', 'admin'), getParentSubscriptionStatus);
router.post('/order', authenticate, authorize('parent', 'admin'), createParentSubscriptionOrder);
router.post('/verify', authenticate, authorize('parent', 'admin'), verifyParentSubscriptionPayment);

export default router;
