import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getCreditPacks,
  createSubscriptionOrder,
  verifySubscriptionPayment,
  createCreditPackOrder,
  verifyCreditPackPayment,
  getPaymentHistory,
} from '../controllers/paymentController';

const router = express.Router();

// Credit packs catalog (any authenticated user can view)
router.get('/credit-packs', authenticate, authorize('teacher'), getCreditPacks);

// Subscription payment flow
router.post('/subscription/order', authenticate, authorize('teacher'), createSubscriptionOrder);
router.post('/subscription/verify', authenticate, authorize('teacher'), verifySubscriptionPayment);

// Credit pack purchase flow
router.post('/credits/order', authenticate, authorize('teacher'), createCreditPackOrder);
router.post('/credits/verify', authenticate, authorize('teacher'), verifyCreditPackPayment);

// Payment history
router.get('/history', authenticate, authorize('teacher', 'parent', 'admin'), getPaymentHistory);

export default router;
