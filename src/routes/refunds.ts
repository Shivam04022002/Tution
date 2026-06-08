import express from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  requestRefund,
  listRefunds,
} from '../controllers/refundController';

const router = express.Router();

// POST /api/refunds          — user requests a refund
router.post('/', authenticate, authorize('teacher', 'parent'), requestRefund);

// GET  /api/refunds          — user: own requests; admin: all
router.get('/', authenticate, authorize('teacher', 'parent', 'admin'), listRefunds);

export default router;
