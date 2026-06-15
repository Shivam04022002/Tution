import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getCreditBalance,
  getCreditHistory,
  unlockLead,
  refundCredit,
} from '../controllers/creditController';

const router = express.Router();

// GET /api/credits/balance — teacher only
router.get('/balance', authenticate, authorize('teacher'), getCreditBalance);

// GET /api/credits/history — teacher only
router.get('/history', authenticate, authorize('teacher'), getCreditHistory);

// POST /api/credits/unlock-lead — teacher only
router.post('/unlock-lead', authenticate, authorize('teacher'), unlockLead);

// POST /api/credits/refund — teacher only
router.post('/refund', authenticate, authorize('teacher'), refundCredit);

export default router;
